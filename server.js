import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

const app = express()

app.use(cors())

const GRAFANA_URL = 'http://localhost:3002'
const TOKEN = 'SEU_TOKEN_AQUI'

app.get('/api/search', async(req,res)=>{
 try{
   const r = await fetch(`${GRAFANA_URL}/api/search?type=dash-db`,{
     headers:{
       Authorization:`Bearer ${TOKEN}`
     }
   })

   const data = await r.json()
   res.json(data)

 }catch(err){
   res.status(500).json({erro:err.message})
 }
})

app.get('/api/dashboards/uid/:uid', async(req,res)=>{
 try{
   const r = await fetch(`${GRAFANA_URL}/api/dashboards/uid/${req.params.uid}`,{
     headers:{
       Authorization:`Bearer ${TOKEN}`
     }
   })

   const data = await r.json()
   res.json(data)

 }catch(err){
   res.status(500).json({erro:err.message})
 }
})
app.get('/api/kpis', async(req,res)=>{
 try{

   const cpu = Math.floor(Math.random()*60)+20
   const mem = Math.floor(Math.random()*50)+30
   const req = Math.floor(Math.random()*900)+100

   res.json({
     cpu,
     mem,
     req,
     status:'UP'
   })

 }catch(err){
   res.status(500).json({erro:err.message})
 }
})

app.listen(3000,()=>{
 console.log('Backend rodando em http://localhost:3000')
})