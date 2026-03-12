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
intents:[GatewayIntentBits.Guilds]
});

let players = fs.readFileSync("./players.txt","utf8")
.split("\n")
.map(x=>x.trim())
.filter(x=>x.length>0);

let clicked = {};
let page = 0;

let panelMessage;
let listMessage1;
let listMessage2;

function loadState(){

if(fs.existsSync("./state.json")){
clicked = JSON.parse(fs.readFileSync("./state.json"));
}

players.forEach(p=>{
if(clicked[p] === undefined) clicked[p] = false;
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

function savePanel(data){

fs.writeFileSync("./panel.json",JSON.stringify(data,null,2));

}

function buildLists(){

let half = Math.ceil(players.length/2);

let left = players.slice(0,half);
let right = players.slice(half);

let lines = [];

for(let i=0;i<half;i++){

let l = left[i] ? `${clicked[left[i]]?"🔴":"🟢"} ${left[i]}` : "";
let r = right[i] ? `${clicked[right[i]]?"🔴":"🟢"} ${right[i]}` : "";

lines.push(`${l.padEnd(30)} ${r}`);

}

let mid = Math.ceil(lines.length/2);

let part1 = lines.slice(0,mid).join("\n");
let part2 = lines.slice(mid).join("\n");

return [
"```"+part1+"```",
"```"+part2+"```"
];

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

let lists = buildLists();

await listMessage1.edit(lists[0]);
await listMessage2.edit(lists[1]);

await panelMessage.edit({
content:"Select player:",
components:[buildMenu(),buildButtons()]
});

}

client.once("ready",async()=>{

console.log(`Bot started as ${client.user.tag}`);

loadState();

const channel = await client.channels.fetch(config.channelId);

const panelData = loadPanel();

try{

if(panelData.panel){

listMessage1 = await channel.messages.fetch(panelData.list1);
listMessage2 = await channel.messages.fetch(panelData.list2);
panelMessage = await channel.messages.fetch(panelData.panel);

await updatePanel();

console.log("Existing panel loaded");

}else{

let lists = buildLists();

listMessage1 = await channel.send(lists[0]);
listMessage2 = await channel.send(lists[1]);

panelMessage = await channel.send({
content:"Select player:",
components:[buildMenu(),buildButtons()]
});

savePanel({
list1:listMessage1.id,
list2:listMessage2.id,
panel:panelMessage.id
});

console.log("New panel created");

}

}catch{

let lists = buildLists();

listMessage1 = await channel.send(lists[0]);
listMessage2 = await channel.send(lists[1]);

panelMessage = await channel.send({
content:"Select player:",
components:[buildMenu(),buildButtons()]
});

savePanel({
list1:listMessage1.id,
list2:listMessage2.id,
panel:panelMessage.id
});

console.log("Panel recreated");

}

});

client.on("interactionCreate",async interaction=>{

if(interaction.channel.id !== config.channelId) return;

if(interaction.isButton()){

if(interaction.customId==="prev") page--;
if(interaction.customId==="next") page++;

await interaction.update({
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

clicked[player] = true;

saveState();

let done = Object.values(clicked).filter(x=>x).length;

await interaction.update({
components:[buildMenu(),buildButtons()]
});

await updatePanel();

if(done === players.length){

interaction.channel.send(
`The list is full (${done}/${players.length}). Reset in ${config.resetMinutes} minutes.`
);

setTimeout(async()=>{

players.forEach(p=>clicked[p] = false);

saveState();

await updatePanel();

interaction.channel.send("The list has been reset.");

},config.resetMinutes*60000);

}

});

client.login(process.env.TOKEN);
