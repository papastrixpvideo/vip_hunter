const {
Client,
GatewayIntentBits,
ActionRowBuilder,
StringSelectMenuBuilder,
ButtonBuilder,
ButtonStyle
} = require("discord.js")

const fs = require("fs")
const config = require("./config.json")

const client = new Client({
intents:[GatewayIntentBits.Guilds]
})

let players = fs.readFileSync("./players.txt","utf8")
.split("\n")
.map(x=>x.trim())
.filter(x=>x.length>0)

let clicked = {}
let page = 0
let panelMessage

function loadState(){

if(fs.existsSync("./state.json")){
clicked = JSON.parse(fs.readFileSync("./state.json"))
}

players.forEach(p=>{
if(clicked[p] === undefined) clicked[p]=false
})

}

function saveState(){

fs.writeFileSync("./state.json",JSON.stringify(clicked,null,2))

}

function loadPanel(){

if(fs.existsSync("./panel.json")){
return JSON.parse(fs.readFileSync("./panel.json"))
}

return {}

}

function savePanel(id){

fs.writeFileSync("./panel.json",JSON.stringify({messageId:id},null,2))

}

function buildList(){

let text = ""

for(const p of players){

text += `${clicked[p] ? "🔴" : "🟢"} ${p}\n`

}

return text

}

function buildMenu(){

let start = page*25
let slice = players.slice(start,start+25)

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

)

}

function buildButtons(){

let maxPage = Math.ceil(players.length/25)-1

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

)

}

async function updatePanel(){

await panelMessage.edit({
content:buildList(),
components:[buildMenu(),buildButtons()]
})

}

client.once("ready", async()=>{

console.log(`Bot started as ${client.user.tag}`)

loadState()

const channel = await client.channels.fetch(config.channelId)

const panelData = loadPanel()

try{

if(panelData.messageId){

panelMessage = await channel.messages.fetch(panelData.messageId)

await updatePanel()

}else{

panelMessage = await channel.send({
content:buildList(),
components:[buildMenu(),buildButtons()]
})

savePanel(panelMessage.id)

}

}catch{

panelMessage = await channel.send({
content:buildList(),
components:[buildMenu(),buildButtons()]
})

savePanel(panelMessage.id)

}

})

client.on("interactionCreate", async interaction=>{

if(interaction.channel.id !== config.channelId) return

if(interaction.isButton()){

if(interaction.customId==="prev") page--
if(interaction.customId==="next") page++

await interaction.update({
components:[buildMenu(),buildButtons()]
})

return

}

if(!interaction.isStringSelectMenu()) return

if(!interaction.member.roles.cache
.some(r=>config.allowedRoles.includes(r.id))){

return interaction.reply({
content:"You do not have permission.",
ephemeral:true
})

}

let player = interaction.values[0]

if(clicked[player]){

return interaction.reply({
content:"This player has already been selected.",
ephemeral:true
})

}

clicked[player] = true

saveState()

await interaction.update({
components:[buildMenu(),buildButtons()]
})

await updatePanel()

})

client.login(process.env.TOKEN)
