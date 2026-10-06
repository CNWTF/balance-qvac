import { loadModel, completion, unloadModel, QWEN3_600M_INST_Q4 } from '@qvac/sdk'
const t=Date.now()
const id = await loadModel({ modelSrc: QWEN3_600M_INST_Q4, modelConfig:{ctx_size:2048} })
console.log('loaded', Date.now()-t, 'ms')
const r = completion({ modelId:id, history:[{role:'user',content:'Say hi in 3 words'}], stream:true })
for await (const _ of r.events) {}
const f = await r.final; console.log(f.contentText, f.stats?.tokensPerSecond)
await unloadModel({modelId:id, clearStorage:false}); process.exit(0)
