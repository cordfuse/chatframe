import { NextRequest, NextResponse } from 'next/server'
import { getDeviceIdFromRequest } from '@/lib/server/jwt'
import {
  runChat, runChatStream, findProvider, isModelValidForProvider,
} from '@/lib/server/ai-tools'

export const maxDuration = 300

const DEFAULT_SYSTEM_PROMPT = process.env.QUILL_SYSTEM_PROMPT ?? 'You are a helpful AI assistant.'
const ENV_PROVIDER = process.env.QUILL_PROVIDER ?? 'anthropic'
const ENV_MODEL = process.env.QUILL_MODEL ?? 'claude-sonnet-4-6'

export async function POST(request: NextRequest) {
  console.log('[chat] request received')
  const deviceId = getDeviceIdFromRequest(request.headers.get('Authorization'))
  if (!deviceId) {
    console.log('[chat] unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { messages, stream: wantStream, provider: clientProvider, model: clientModel } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
  }

  // Provider: prefer client choice if valid, else fall back to env default.
  let providerId = ENV_PROVIDER
  if (typeof clientProvider === 'string') {
    if (!findProvider(clientProvider)) {
      return NextResponse.json({ error: `Unknown provider '${clientProvider}'` }, { status: 400 })
    }
    providerId = clientProvider
  }
  const providerInfo = findProvider(providerId)
  if (!providerInfo) {
    return NextResponse.json({ error: `Unknown provider '${providerId}'` }, { status: 400 })
  }

  // Model: prefer client choice if valid, else env default if it matches,
  // else the provider's defaultModel from the registry.
  let model: string
  if (typeof clientModel === 'string') {
    if (!isModelValidForProvider(providerId, clientModel)) {
      return NextResponse.json({
        error: `Model '${clientModel}' is not registered for provider '${providerId}'`,
      }, { status: 400 })
    }
    model = clientModel
  } else if (providerId === ENV_PROVIDER && isModelValidForProvider(providerId, ENV_MODEL)) {
    model = ENV_MODEL
  } else {
    model = providerInfo.defaultModel
  }

  // Cloud providers need an API key in the env. Local providers don't
  // (they hit a local OpenAI-compatible server with a sentinel apiKey).
  if (providerInfo.category === 'cloud') {
    const requiredKey = providerInfo.envKey
    if (requiredKey && !process.env[requiredKey]) {
      return NextResponse.json({
        error: `Service unavailable — ${requiredKey} not set for provider '${providerId}'.`,
      }, { status: 503 })
    }
  }

  const provider = providerId

  console.log(`[chat] msgs=${messages.length} provider=${provider} model=${model} stream=${!!wantStream}`)

  if (wantStream) {
    const enc = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
        try {
          for await (const delta of runChatStream(messages, provider, model, DEFAULT_SYSTEM_PROMPT)) {
            send({ type: 'delta', content: delta })
          }
          send({ type: 'done' })
          console.log('[chat] stream done')
        } catch (err) {
          console.error('[chat] stream error:', err)
          const message = err instanceof Error ? err.message : 'Internal server error'
          send({ type: 'error', message })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  try {
    const result = await runChat(messages, provider, model, DEFAULT_SYSTEM_PROMPT)
    console.log('[chat] done')
    return NextResponse.json(result)
  } catch (err) {
    console.error('[chat] error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
