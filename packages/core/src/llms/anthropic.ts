import { Anthropic } from '@anthropic-ai/sdk'
import { type SetOptional } from 'type-fest'

import * as types from '@/types'
import { DEFAULT_ANTHROPIC_MODEL } from '@/constants'
import { getEnv } from '@/env'

import { BaseChatCompletion } from './chat'

const defaultStopSequences = [Anthropic.HUMAN_PROMPT]

export class AnthropicChatCompletion<
  TInput extends types.TaskInput = any,
  TOutput extends types.TaskOutput = string
> extends BaseChatCompletion<
  TInput,
  TOutput,
  SetOptional<
    Omit<Anthropic.CompletionCreateParams, 'prompt'>,
    'model' | 'max_tokens_to_sample' | 'stop_sequences'
  >,
  Anthropic.Completion
> {
  _client: Anthropic

  constructor(
    options: types.ChatModelOptions<
      TInput,
      TOutput,
      SetOptional<
        Omit<Anthropic.CompletionCreateParams, 'prompt'>,
        'model' | 'max_tokens_to_sample' | 'stop_sequences'
      >
    >
  ) {
    super({
      provider: 'anthropic',
      model:
        options.modelParams?.model ??
        getEnv('ANTHROPIC_MODEL') ??
        getEnv('ANTHROPIC_DEFAULT_MODEL', DEFAULT_ANTHROPIC_MODEL),
      ...options
    })

    if (this._agentic?.anthropic) {
      this._client = this._agentic.anthropic
    } else {
      throw new Error(
        'AnthropicChatCompletion requires an Anthropic client to be configured on the Agentic runtime'
      )
    }
  }

  public override get nameForModel(): string {
    return 'anthropicChatCompletion'
  }

  protected override async _createChatCompletion(
    messages: types.ChatMessage[]
  ): Promise<types.BaseChatCompletionResponse<Anthropic.Completion>> {
    const prompt =
      messages
        .map((message) => {
          switch (message.role) {
            case 'user':
              return `${Anthropic.HUMAN_PROMPT} ${message.content}`
            case 'assistant':
              return `${Anthropic.AI_PROMPT} ${message.content}`
            default:
              return message.content
          }
        })
        .filter(Boolean)
        .join('') + Anthropic.AI_PROMPT

    // TODO: support streaming
    // TODO: support max_tokens_to_sample
    // TODO: support stop_sequences correctly
    // TODO: handle errors gracefully

    const response = await this._client.completions.create({
      stop_sequences: defaultStopSequences,
      max_tokens_to_sample: 200, // TODO
      ...this._modelParams,
      model: this._model,
      prompt,
      stream: false
    })

    return {
      message: {
        role: 'assistant',
        content: response.completion
      },
      response
    }
  }

  public override clone(): AnthropicChatCompletion<TInput, TOutput> {
    return new AnthropicChatCompletion<TInput, TOutput>({
      agentic: this._agentic,
      timeoutMs: this._timeoutMs,
      retryConfig: this._retryConfig,
      inputSchema: this._inputSchema,
      outputSchema: this._outputSchema,
      provider: this._provider,
      model: this._model,
      examples: this._examples,
      messages: this._messages,
      ...this._modelParams
    })
  }
}
