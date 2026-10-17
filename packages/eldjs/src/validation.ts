import type { Context } from 'hono'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  AppEnv,
  ParamValidators,
  Validators,
  ValidationTarget,
} from './types.js'

export class InputError extends Error {
  constructor(
    public target: ValidationTarget,
    public issues: readonly StandardSchemaV1.Issue[],
    public status: 400 | 415 = 400,
  ) {
    super('Invalid request input')
  }
}
function isSchema(
  value: StandardSchemaV1 | ParamValidators,
): value is StandardSchemaV1 {
  const props = value['~standard']
  return (
    typeof props === 'object' &&
    props !== null &&
    'validate' in props &&
    typeof props.validate === 'function'
  )
}

async function validateParamFields(
  validators: ParamValidators,
  params: Record<string, string>,
) {
  const output: Record<string, unknown> = Object.create(null)
  let issues: StandardSchemaV1.Issue[] | undefined
  for (const [key, schema] of Object.entries(validators)) {
    const result = await schema['~standard'].validate(params[key])
    if (result.issues) {
      issues ??= []
      issues.push(
        ...result.issues.map((issue) => ({
          ...issue,
          path: [key, ...(issue.path ?? [])],
        })),
      )
    } else {
      output[key] = result.value
    }
  }
  if (issues) throw new InputError('params', issues)
  return output
}
async function readInput(
  c: Context<AppEnv>,
  target: ValidationTarget,
  params: Record<string, string>,
): Promise<unknown> {
  switch (target) {
    case 'params':
      return params
    case 'headers':
      return Object.fromEntries(c.req.raw.headers)
    case 'query':
      return Object.fromEntries(
        Object.entries(c.req.queries()).map(([key, values]) => [
          key,
          values.length === 1 ? values[0] : values,
        ]),
      )
    case 'json': {
      if (
        !/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(
          c.req.header('content-type') ?? '',
        )
      )
        throw new InputError(
          target,
          [{ message: 'Expected an application/json content type' }],
          415,
        )
      try {
        return await c.req.json()
      } catch {
        throw new InputError(target, [{ message: 'Malformed JSON body' }])
      }
    }
    case 'form': {
      if (
        !/^(?:application\/x-www-form-urlencoded|multipart\/form-data)(?:;|$)/i.test(
          c.req.header('content-type') ?? '',
        )
      )
        throw new InputError(
          target,
          [{ message: 'Expected form content' }],
          415,
        )
      try {
        return await c.req.parseBody({ all: true })
      } catch {
        throw new InputError(target, [{ message: 'Malformed form body' }])
      }
    }
  }
}
export async function validateInput(
  c: Context<AppEnv>,
  validators: Validators,
  params: Record<string, string>,
) {
  if (validators.json && validators.form)
    throw new Error('A handler cannot validate both JSON and form bodies')
  const input: Record<string, unknown> = Object.create(null)
  for (const target of Object.keys(validators) as ValidationTarget[]) {
    const validator = validators[target]
    if (validator === undefined) continue
    if (!isSchema(validator)) {
      if (target !== 'params')
        throw new Error(`${target} requires a Standard Schema validator`)
      input.params = await validateParamFields(validator, params)
      continue
    }
    const result = await validator['~standard'].validate(
      await readInput(c, target, params),
    )
    if (result.issues) throw new InputError(target, result.issues)
    input[target] = result.value
  }
  return input
}
export function inputErrorResponse(c: Context<AppEnv>, error: InputError) {
  return c.json(
    {
      error: 'VALIDATION_ERROR' as const,
      target: error.target,
      issues: error.issues.map((issue) => ({
        message: issue.message,
        ...(issue.path
          ? {
              path: issue.path.map((part) =>
                typeof part === 'object'
                  ? typeof part.key === 'symbol'
                    ? String(part.key)
                    : part.key
                  : typeof part === 'symbol'
                    ? String(part)
                    : part,
              ),
            }
          : {}),
      })),
    },
    error.status,
  )
}
