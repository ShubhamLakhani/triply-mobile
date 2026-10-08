import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type UseFormProps } from 'react-hook-form';
import type { z } from 'zod';

/**
 * React Hook Form bound to a Zod schema. Screens get typed values (schema output) and the same
 * schema is reused by feature services and re-validated server-side.
 */
export function useZodForm<TInput extends FieldValues, TOutput extends FieldValues>(
  schema: z.ZodType<TOutput, TInput>,
  options?: Omit<UseFormProps<TInput, unknown, TOutput>, 'resolver'>,
) {
  return useForm<TInput, unknown, TOutput>({
    mode: 'onTouched',
    ...options,
    resolver: zodResolver(schema),
  });
}
