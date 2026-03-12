const {
Client,
GatewayIntentBits,
ActionRowBuilder,
StringSelectMenuBuilder,
ButtonBuilder,
ButtonStyle
} = require("discord.js");

const fs = require("fs");
const config = require("./config.json");

const client = new Client({
intents: [GatewayIntentBits.Guilds]
});

let players = fs.readFileSync("./players.txt","utf8")
.split("\n")
.map(x=>x.trim())
.filter(x=>x.length>0);

let clicked = {};
let page = 0;
let panelMessage;

function loadState(){

if(fs.existsSync("./state.json")){
clicked = JSON.parse(fs.readFileSync("./state.json"));
}

players.forEach(p=>{
if(clicked[p] === undefined) clicked[p]=false;
});

}

function saveState(){
fs.writeFileSync("./state.json",JSON.stringify(clicked,null,2));
}

function loadPanel(){

if(fs.existsSync("./panel.json")){
return JSON.parse(fs.readFileSync("./panel.json"));
}

return {};
}

function savePanel(id){
fs.writeFileSync("./panel.json",JSON.stringify({messageId:id},null,2));
}

function buildList(){

let half = Math.ceil(players.length/2);

let left = players.slice(0,half);
let right = players.slice(half);

let text = "";

for(let i=0;i<half;i++){

let l = left[i] ? `${clicked[left[i]] ? "🔴" : "🟢"} ${left[i]}` : "";
let r = right[i] ? `${clicked[right[i]] ? "🔴" : "🟢"} ${right[i]}` : "";

text += `${l.padEnd(30)} ${r}\n`;

}

return "```"+text+"```";
}

function buildMenu(){

let start = page*25;
let slice = players.slice(start,start+25);

return new ActionRowBuilder().addComponents(
new StringSelectMenuBuilder()
.setCustomId("player_select")
.setPlaceholder(`Players ${start+1}-${start+slice.length}`)
.addOptions(
slice.map(p=>({
label:p,
value:p,
description: clicked[p] ? "Already selected" : "Available"
}))
)
);

}

function buildButtons(){

let maxPage = Math.ceil(players.length/25)-1;

return new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("prev")
.setLabel("◀")
.setStyle(ButtonStyle.Secondary)
.setDisabled(page===0),

new ButtonBuilder()
.setCustomId("next")
.setLabel("▶")
.setStyle(ButtonStyle.Secondary)
.setDisabled(page===maxPage)

);

}

async function updatePanel(){

await panelMessage.edit({
content:buildList(),
components:[buildMenu(),buildButtons()]
});

}

client.once("ready", async ()=>{

console.log(`Bot started as ${client.user.tag}`);

loadState();

const channel = await client.channels.fetch(config.channelId);

const panelData = loadPanel();

try{

if(panelData.messageId){

panelMessage = await channel.messages.fetch(panelData.messageId);

await updatePanel();

console.log("Existing panel loaded.");

}else{

panelMessage = await channel.send({
content:buildList(),
components:[buildMenu(),buildButtons()]
});

savePanel(panelMessage.id);

console.log("New panel created.");

}

}catch{

panelMessage = await channel.send({
content:buildList(),
components:[buildMenu(),buildButtons()]
});

savePanel(panelMessage.id);

console.log("Panel recreated.");

}

});

client.on("interactionCreate", async interaction=>{

if(interaction.channel.id !== config.channelId) return;

if(interaction.isButton()){

if(interaction.customId==="prev") page--;
if(interaction.customId==="next") page++;

await interaction.update({
content:buildList(),
components:[buildMenu(),buildButtons()]
});

return;

}

if(!interaction.isStringSelectMenu()) return;

if(!interaction.member.roles.cache
.some(r=>config.allowedRoles.includes(r.id))){

return interaction.reply({
content:"You do not have permission.",
ephemeral:true
});
}

let player = interaction.values[0];

if(clicked[player]){

return interaction.reply({
content:"This player has already been selected.",
ephemeral:true
});
}

clicked[player]=true;

saveState();

let done = Object.values(clicked).filter(x=>x).length;

await interaction.update({
content:buildList(),
components:[buildMenu(),buildButtons()]
});

if(done===players.length){

interaction.channel.send(
`The list is full (${done}/${players.length}). Reset in ${config.resetMinutes} minutes.`
);

setTimeout(async()=>{

players.forEach(p=>clicked[p]=false);

saveState();

await updatePanel();

interaction.channel.send("The list has been reset.");

},config.resetMinutes*60000);

}

});

client.login(process.env.TOKEN);