// IMPORTING CERTAIN THINGS

import { spawn } from "child_process";
import { Readable } from "stream";
import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { AudioPlayer, AudioPlayerStatus, AudioResource, NoSubscriberBehavior,
    StreamType,
    VoiceConnection,
    createAudioPlayer, createAudioResource, demuxProbe, joinVoiceChannel } from "@discordjs/voice"
import ytsr from "ytsr";
import { config } from "dotenv";

config();

const PREFIX="."
const API_TOKEN=process.env["API_TOKEN"];
const BOT_PROFILE=process.env["BOT_PROFILE"];

// SOME FUNCTIONS

const remove = (array, index) =>{
    const newArray = []
    for(let i = 0; i < array.length; i++){
        if(i == index) continue;
        newArray.push(array[i])
    }
    return newArray;
}

// CLIENT
const client = new Client({ intents: [ 
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
]})

client.login(API_TOKEN)

class GuildState {
    /** @type {string} */ guildId
    /** @type {bool} */ loop
    /** @type {{title: string, url: string}[]} */ musicqueue
    /** @type {VoiceConnection|null} */ voiceconn
    /** @type {AudioPlayer} */ audioplayer

    /**
     * @param {string} guildId
     */
    constructor(guildId) {
        this.guildId = guildId
        this.loop = false;
        this.musicqueue = [];
        this.voiceconn = null;
        this.audioplayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
            }
        });
    }

    /**
     * @param {string} channelId
     * @param {DiscordGatewayAdaptorCreator} adapterCreator
     */
    joinVoiceChannel(channelId, adapterCreator) {
        this.voiceconn = joinVoiceChannel({
            channelId: channelId,
            guildId: this.guildId,
            adapterCreator
        });
        this.voiceconn.subscribe(this.audioplayer);
    }

    leftCurrentVoiceChannel() {
        if(this.voiceconn !== null) {
            this.voiceconn.destroy();
            this.voiceconn = null;
        }
    }

    /**
     * @return {bool}
     */
    hasJoinAnyVoiceChannel() {
        return this.voiceconn !== null;
    }


    /**
     * @param {VoiceConnection} voiceConn
     * @param {AudioResource} audioResource
     */
    playAudioResource(audioResource) {
        this.audioplayer.play(audioResource);
    }

    stopPlayAudioResource() {
        this.audioplayer.stop();
    }


    /**
     * @param {(music: {title: string, url: string}) => void} callback
     */
    async startPlayMusicQueue(callback) {
        /**
         * @param {(music: {title: string, url: string}) => void} callback
         */
        const play = async (callback) => {
            const top = this.musicqueue.shift();
            this.musicqueue.push(top);
            console.log(top);
            callback(top);

            const ytdlp = spawn("yt-dlp", [
                "-f", "bestaudio",
                "-o", "-",
                "--no-playlist",
                top.url,
            ], { stdio: ["ignore", "pipe"] });


            const { stream, inputType } = await demuxProbe(ytdlp.stdout);
            const resource  = createAudioResource(stream, { inputType, })
            this.playAudioResource(resource);
            this.audioplayer.once(AudioPlayerStatus.Idle, () => {
                play(callback);
            })
        }
        play(callback);
    }

}

/** @type {Record<string, GuildState>} */
const guilds = {}

client.on("ready", () => {
    console.log("Bot is ready")
})

client.on("messageCreate", async msg => {
    const BOT_ICON = `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.webp`;
    if(msg.author.id !== client.user.id && msg.author.bot == false) {

        if(msg.content == `<@!${client.user.id}>`){
            msg.channel.send(`Yes, What is it ${msg.author}??? If you need any help you can use **help** command with my prefix which is "**${PREFIX}**"`)
            return;
        }

        if(!Object.keys(guilds).includes(msg.guild.id)) {
            guilds[msg.guildId] = new GuildState(msg.guild.id);
        }

        /** @type {GuildState} */
        const guild = guilds[msg.guild.id]
        const args = msg.content.split(" ")
        switch(args[0]) {
            case `${PREFIX}ping`:
                {
                    msg.reply("PONG!")
                } break;
            case `${PREFIX}hbd`:
                {
                    const input = args.splice(1).join(" ")
                    msg.channel.send(`Happy Birthday ${input} from IKAN's developer" +
                        "please open this link https://bagasjs.github.io/birthday-card/?name=${input}`)
                } break;
            case `${PREFIX}help`:
                {
                    const embed = new EmbedBuilder()
                    .setTitle("Help ~ IKAN")
                    .setColor(0xF1C40F)
                    .setDescription("**IKAN** is a free discord music bot. The name itself is taken from the word fish in Indonesian. Why did I name it 'IKAN'? Because I am a fish")
                    .setAuthor({ name: client.user.username, iconURL: BOT_ICON, })
                    .setThumbnail(BOT_ICON)
                    .addFields(
                        { name: '\u200B', value: '\u200B' },
                        { 
                            name: 'List of Commands', 
                            value:`don't forget to use the prefix **${PREFIX}** and type the command is lowercase`
                        },
                        { name: '`add`', value: 'To add a new song based on keywords or youtube link', inline: true },
                        { name: '`remove`', value: 'Removing a song based on the index', inline: true },
                        { name: '`queue`', value: 'To get the list of queue music', inline: true },
                        { name: '`play`', value: 'To start the queued music + connect the bot to the music channel', inline:true},
                        { name: '`skip`', value: 'To skip current song', inline: true },
                        { name: '`stop`', value: 'To disconnect the bot + clear all the queue', inline: true },
                        { name: '`loop`', value: 'Looping the queue', inline:true},
                        { name: '`help`', value: 'To get the command list', inline: true },
                    )
                    .setImage(BOT_ICON)
                    .setTimestamp()
                    .setFooter({ 
                        text: "by bagasjs @2024", 
                        iconURL: BOT_ICON,
                    });
                    msg.channel.send({ embeds: [ embed ] })
                } break;

            case `${PREFIX}play`:
                {
                    if(guild.musicqueue.length == 0){
                        msg.channel.send("Nothing in the queue please use **add** command to enter a music")
                        return;
                    }

                    if(!msg.member.voice.channel){
                        msg.reply("You must be in a voice channel to play the bot!")
                    }

                    const permissions = msg.member.voice.channel.permissionsFor(client.user)
                    if(!permissions.has(PermissionFlagsBits.Connect)){
                        msg.channel.send(` <@!${client.user.id}> doesn't has certain PERMISSIONS to swim in your voice channel`)
                        return;
                    }

                    if(!permissions.has(PermissionFlagsBits.Speak)){
                        msg.channel.send(` <@!${client.user.id}> doesn't has certain PERMISSIONS to swim in your voice channel`)
                    }

                    if(!guild.hasJoinAnyVoiceChannel()) {
                        guild.joinVoiceChannel(msg.member.voice.channel.id, msg.guild.voiceAdapterCreator);
                        if(!guild.hasJoinAnyVoiceChannel()) {
                            msg.reply("Something went wrong please contact the BOT developer")
                        }
                    }

                    await guild.startPlayMusicQueue(({ title, url }) => {
                        const embed = new EmbedBuilder()
                            .setTitle(title)
                            .setURL(url)
                            .setAuthor({ 
                                name: "Playing...",
                                iconURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.webp`,
                            }) 
                        msg.channel.send({ embeds: [embed] })
                    });
                } break;
            case `${PREFIX}stop`:
                {
                    guild.stopPlayAudioResource();
                    guild.leftCurrentVoiceChannel();
                    guild.musicqueue = []
                    msg.channel.send("Disconnecting. Bye bye!")
                } break;
            case `${PREFIX}loop`:
                {
                    guild.loop = !guild.loop
                    if(guild.loop) {
                        msg.channel.send("Now looping the queue")
                    } else {
                        msg.channel.send("Not looping the queue")
                    }
                } break;
            case `${PREFIX}add`:
                {
                    const input = args.splice(1).join(" ")
                    ytsr.getFilters(input).then(filters => {
                        const filter = filters.get("Type").get("Video")
                        ytsr(filter.url, { limit: 1 }).then(ret => {
                            const music_data = ret.items[0]
                            const embed = new EmbedBuilder()
                                .setTitle(music_data.title)
                                .setURL(music_data.url)
                                .setAuthor({ 
                                    name: "Adding music...",
                                    iconURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.webp`
                                })
                            msg.channel.send({ embeds: [embed] })
                            guild.musicqueue.push({ title: music_data.title, url: music_data.url })
                        });
                    })
                    msg.channel.send("Searching music...")
                } break;
            case `${PREFIX}queue`:
                {
                    if(guild.musicqueue.length == 0){
                        msg.channel.send("No Music in Queue")
                        return;
                    }
                    let text = ""
                    for(let i = 0; i < guild.musicqueue.length; i++){
                        if(i == 0 && guild.musicqueue.length > 1){
                            text+="[PLAYING NOW]\n " + (i+1) +". " + guild.musicqueue[i].title + "\n\n[NEXT SONG]\n"
                        }
                        else{
                            text+=(i+1) +". "+ guild.musicqueue[i].title + "\n"
                        }
                    }
                    const embed = new EmbedBuilder()
                        .setTitle("Music Queue ~ IKAN")
                        .setColor(0xF1C40F)
                        .addFields({ name : `Repeat : ${guild.loop}`, value : "Use **loop** command to repeat the queue" })
                        .setDescription(text)
                    msg.channel.send({ embeds: [ embed ] })
                } break;
            case `${PREFIX}remove`:
                {
                    if(guild.musicqueue.length == 0){
                        msg.channel.send("The queue is clear")
                        return;
                    }

                    if(!args[1]){
                        msg.channel.send("Please define the **index** of song that you want to remove")
                    }
                    const index = parseInt(args[1]) - 1

                    if(index < 0){
                        return;
                    }
                    if(index === NaN){
                        msg.channel.send("Please enter the **index** of the song in the queue")
                        return;
                    }

                    server.queue = remove(guild.musicqueue, index)
                    msg.channel.send(`${guild.musicqueue[index].title} is removed`)
                } break;
            case `${PREFIX}invite`:
                {
                    msg.reply("Hmm...there's some problem in my program that make me can't swim in multiserver. " +
                        "If you need a music bot like me in your server please contact my creator Danshiko#8601. " +
                        "He will create my clone for you. Thank you")
                } break;
            case `${PREFIX}skip`:
                {
                    guild.stopPlayAudioResource();
                    guild.audioplayer.removeAllListeners()
                    await guild.startPlayMusicQueue(({ title, url }) => {
                        const embed = new EmbedBuilder()
                            .setTitle(title)
                            .setURL(url)
                            .setAuthor({ 
                                name: "Playing...",
                                iconURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.webp`,
                            }) 
                        msg.channel.send({ embeds: [embed] })
                    });
                } break;
        }


        /** Deprecated
        if(!servers[msg.guild.id]){
            servers[msg.guild.id] = {
                PREFIX,
                queue : [],
                loop : false,
                forecast : {},
                voicechan: null,
                audioplayer: null,
                currentaudio: null,
                audiomanager: new AudioManager(),
            }
        }
        const server = servers[msg.guild.id]
        if(msg.content == `${PREFIX}daily-forecast` || msg.content == `${PREFIX}df`){
            const server = servers[msg.guild.id]
            const date = new Date()
            const today = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            if(server.forecast[today]){
                msg.channel.send(`${msg.author}, You've done it today`)
            }
            else{
                server.forecast[today] = {}
                const randoms = Math.floor(Math.random() * 10)
                let forecast, advice;

                if(randoms == 0){
                    forecast = "Very Unlucky"
                    advice = ["Something bad will be happened to you", "Stay at home today", "You have a very high chance to die today, LOL", "Be careful!"]
                }
                else if(randoms == 1 || randoms == 2){
                    forecast = "Unlucky"
                    advice = ["Something bad may be happened to you", "Please don't go out often today", "Don't forget to pray.",]
                }
                else if(randoms == 3 || randoms == 4){
                    forecast = "Lucky"
                    advice = ["Nice...", "Something good may be happened today", "Cool..."]
                }
                else if(randoms == 5){
                    forecast = "Very Lucky"
                    advice = ["Try to gaacha today!!!", "What the heck!!!", "Don't forget to share later :V"]
                }
                else{
                    forecast = "Normal"
                    advice = ["Bruh...", "...", "Just a normal day"]
                }

                server.forecast[today][msg.author.id] = forecast 
                msg.reply(`You're ${forecast}, today ${advice[0]}`)
            }
        }
        */
    }
})
