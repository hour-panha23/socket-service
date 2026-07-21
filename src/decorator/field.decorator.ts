import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';

/**
 * Opts can be:
 * 1. boolean: true (optional), false (required)
 * 2. object: { optional: boolean, ...ValidationOptions }
 */
type Opts =
  | boolean
  | ({
      optional?: boolean;
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      validateIf?: (object: any, value: any) => boolean;
    } & ValidationOptions);

// A type for your allowed values
/**
 * Helper to determine if a field is optional based on the Opts provided
 */
function isOptional(opts?: Opts): boolean {
  if (opts === true) return true;
  if (typeof opts === 'object') return !!opts.optional;
  return false;
}

/**
 * Helper to extract class-validator options (like custom messages) from Opts
 */
function getOptions(opts?: Opts): ValidationOptions {
  if (typeof opts === 'object') {
    // Rename 'optional' to '_optional' to satisfy the linter
    const { optional: _optional, ...rest } = opts;
    return rest;
  }
  return {};
}

/**
 * Applies IsOptional or IsNotEmpty based on the configuration
 */
function ApplyPresence(target: object, propertyKey: string, opts?: Opts) {
  const options = getOptions(opts);

  if (typeof opts === 'object' && opts.validateIf) {
    ValidateIf(opts.validateIf, options)(target, propertyKey);
  }

  if (isOptional(opts)) {
    IsOptional(options)(target, propertyKey);
  } else {
    // This ensures the field is not null, undefined, or an empty string
    IsNotEmpty(options)(target, propertyKey);
  }
}

function getEffectiveArgs<T>(optsOrValues?: Opts | T[], values?: T[]) {
  let effectiveOpts: Opts = false;
  let effectiveValues: T[] | undefined = values;

  if (Array.isArray(optsOrValues)) {
    effectiveValues = optsOrValues;
    effectiveOpts = false;
  } else if (optsOrValues !== undefined) {
    effectiveOpts = optsOrValues;
  }

  return { effectiveOpts, effectiveValues, options: getOptions(effectiveOpts) };
}

export function Str(optsOrValues?: Opts | string[], values?: string[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);
    IsString(options)(target, propertyKey);

    if (typeof effectiveOpts === 'object') {
      if (effectiveOpts.minLength !== undefined) {
        MinLength(effectiveOpts.minLength, options)(target, propertyKey);
      }
      if (effectiveOpts.maxLength !== undefined) {
        MaxLength(effectiveOpts.maxLength, options)(target, propertyKey);
      }
    }

    if (effectiveValues) IsIn(effectiveValues, options)(target, propertyKey);
  };
}

export function StrArray(optsOrValues?: Opts | string[], values?: string[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);
    IsArray(options)(target, propertyKey);
    IsString({ ...options, each: true })(target, propertyKey);

    if (typeof effectiveOpts === 'object') {
      if (effectiveOpts.minLength !== undefined) {
        MinLength(effectiveOpts.minLength, { ...options, each: true })(
          target,
          propertyKey,
        );
      }
      if (effectiveOpts.maxLength !== undefined) {
        MaxLength(effectiveOpts.maxLength, { ...options, each: true })(
          target,
          propertyKey,
        );
      }
    }
    // CRITICAL: added each: true here
    if (effectiveValues)
      IsIn(effectiveValues, { ...options, each: true })(target, propertyKey);
  };
}

export function Int(optsOrValues?: Opts | number[], values?: number[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    Transform(({ value }) => (value == null ? value : Number(value)))(
      target,
      propertyKey,
    );
    Type(() => Number)(target, propertyKey);
    ApplyPresence(target, propertyKey, effectiveOpts);
    IsInt(options)(target, propertyKey);

    // Add these lines:
    if (typeof effectiveOpts === 'object' && effectiveOpts.min !== undefined) {
      Min(effectiveOpts.min, options)(target, propertyKey);
    }
    if (typeof effectiveOpts === 'object' && effectiveOpts.max !== undefined) {
      Max(effectiveOpts.max, options)(target, propertyKey);
    }

    if (effectiveValues?.length) {
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function SmallInt(optsOrValues?: Opts | number[], values?: number[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    // 1. Transform string → number (handles "123" → 123)
    Transform(({ value }) => {
      if (value === null || value === undefined) return value;
      return Number(value);
    })(target, propertyKey);

    // 2. Ensure type is Number for validation
    Type(() => Number)(target, propertyKey);

    // 3. Apply presence (optional/required)
    ApplyPresence(target, propertyKey, effectiveOpts);

    // 4. Validate it's an integer within PostgreSQL SmallInt range
    IsInt(options)(target, propertyKey);
    Min(
      typeof effectiveOpts === 'object' && effectiveOpts.min !== undefined
        ? effectiveOpts.min
        : -32768,
      options,
    )(target, propertyKey);
    Max(
      typeof effectiveOpts === 'object' && effectiveOpts.max !== undefined
        ? effectiveOpts.max
        : 32767,
      options,
    )(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      // Validate that the value is one of the allowed values
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function Num(optsOrValues?: Opts | number[], values?: number[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    // 1. Transform string → number (handles "123.45" → 123.45)
    Transform(({ value }) => {
      if (value === null || value === undefined) return value;
      return Number(value);
    })(target, propertyKey);

    // 2. Ensure type is Number for class-transformer
    Type(() => Number)(target, propertyKey);

    // 3. Apply presence (optional/required) based on your Opts helper
    ApplyPresence(target, propertyKey, effectiveOpts);

    // 4. Validate it's a number (this allows decimals, unlike IsInt)
    IsNumber({}, options)(target, propertyKey);

    if (typeof effectiveOpts === 'object' && effectiveOpts.min !== undefined) {
      Min(effectiveOpts.min, options)(target, propertyKey);
    }
    if (typeof effectiveOpts === 'object' && effectiveOpts.max !== undefined) {
      Max(effectiveOpts.max, options)(target, propertyKey);
    }

    if (effectiveValues && effectiveValues.length > 0) {
      // Validate that the value is one of the allowed values
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function Date(optsOrValues?: Opts | Date[], values?: Date[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);
    Type(() => globalThis.Date)(target, propertyKey);
    IsDate(options)(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      // Validate that the value is one of the allowed values
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function Bool(optsOrValues?: Opts | boolean[], values?: boolean[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);
    IsBoolean(options)(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      // Validate that the value is one of the allowed values
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function Email(optsOrValues?: Opts | string[], values?: string[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);

    // Fix: Pass {} for IsEmailOptions, then options for ValidationOptions
    IsEmail({}, options)(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      // Validate that the value is one of the allowed values
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function UUID(optsOrValues?: Opts | string[], values?: string[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);
    IsUUID('4', options)(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      // Validate that the value is one of the allowed values
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function IntArray(optsOrValues?: Opts | number[], values?: number[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    Transform(({ value }) =>
      Array.isArray(value)
        ? value.map((v) => (v === null ? v : Number(v)))
        : value,
    )(target, propertyKey);

    ApplyPresence(target, propertyKey, effectiveOpts);
    IsArray(options)(target, propertyKey);
    IsInt({ ...options, each: true })(target, propertyKey);

    if (typeof effectiveOpts === 'object' && effectiveOpts.min !== undefined) {
      Min(effectiveOpts.min, { ...options, each: true })(target, propertyKey);
    }
    if (typeof effectiveOpts === 'object' && effectiveOpts.max !== undefined) {
      Max(effectiveOpts.max, { ...options, each: true })(target, propertyKey);
    }

    if (effectiveValues && effectiveValues.length > 0) {
      // Must use each: true here too!
      IsIn(effectiveValues, { ...options, each: true })(target, propertyKey);
    }
  };
}

export function Json(optsOrValues?: Opts | object[], values?: object[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    // Add this Transform block to handle strings from URL queries
    Transform(({ value }) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    })(target, propertyKey);

    ApplyPresence(target, propertyKey, effectiveOpts);
    IsObject(options)(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

export function Obj(
  optsOrValues?: Opts | object[],
  values?: object[],
  typeClass?: new () => any,
) {
  const { effectiveOpts, options } = getEffectiveArgs(optsOrValues, values);

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);
    IsObject(options)(target, propertyKey);

    if (typeClass) {
      ValidateNested(options)(target, propertyKey);
      Type(() => typeClass)(target, propertyKey);
    }
  };
}

export function ObjArray(typeClass: new () => any, opts?: Opts) {
  const options = getOptions(opts);

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, opts);
    IsArray(options)(target, propertyKey);
    ValidateNested({ ...options, each: true })(target, propertyKey);
    Type(() => typeClass)(target, propertyKey);
  };
}

export function Arr(optsOrValues?: Opts | any[], values?: any[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    ApplyPresence(target, propertyKey, effectiveOpts);
    IsArray(options)(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      // Validate that the value is one of the allowed values
      IsIn(effectiveValues, options)(target, propertyKey);
    }
  };
}

// Add this new decorator to field.decorator.ts
export function JsonArray(optsOrValues?: Opts | object[], values?: object[]) {
  const { effectiveOpts, effectiveValues, options } = getEffectiveArgs(
    optsOrValues,
    values,
  );

  return function (target: object, propertyKey: string) {
    // Handle JSON string parsing for query params
    Transform(({ value }) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    })(target, propertyKey);

    ApplyPresence(target, propertyKey, effectiveOpts);
    IsArray(options)(target, propertyKey);

    if (effectiveValues && effectiveValues.length > 0) {
      IsIn(effectiveValues, { ...options, each: true })(target, propertyKey);
    }
  };
}
