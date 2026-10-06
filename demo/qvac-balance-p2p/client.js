// Client wrappers (Metro-safe): open a P2P node inside the QVAC worker, join a topic, send and poll BOP messages.
import { loadModel, unloadModel, invokePlugin } from '@qvac/sdk'

// modelSrc must be an existing local file; the plugin does not read it.
export async function openP2P({ anchorPath, seed }) {
  return loadModel({ modelSrc: anchorPath, modelType: 'balance-p2p', modelConfig: seed ? { seed } : {} })
}
export const closeP2P = (modelId) => unloadModel({ modelId, clearStorage: false })
export const joinTopic = ({ modelId, topic, name, role }) => invokePlugin({ modelId, handler: 'join', params: { modelId, topic, name, role } })
export const sendMessage = ({ modelId, msg, toRole, toKey }) => invokePlugin({ modelId, handler: 'send', params: { modelId, msg, toRole, toKey } })
export const pollMessages = ({ modelId }) => invokePlugin({ modelId, handler: 'poll', params: { modelId } })
export const refreshP2P = ({ modelId }) => invokePlugin({ modelId, handler: 'refresh', params: { modelId } })
