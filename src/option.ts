import {Validator, Preprocessor, makeValidator, BooleanValidator} from './pipeline';

type TypeMap = {
    number: number;
    int: number;
    string: string;
    boolean: boolean;
    any: number | string | boolean;
}

export type Types = keyof TypeMap;

export type ResolveType<T extends Types> = TypeMap[T];

const intrinsicPreProcessors: Partial<Record<Types, Preprocessor>> = {
    string: s => typeof s === 'number' ? String(s) : s
}

const intrinsicValidators: Partial<Record<Types, BooleanValidator<any>>> = {
    number: n => n * 1 === n,
    int: n => Number.isInteger(n),
    string: s => typeof s === 'string',
    boolean: b => typeof b === 'boolean'
}

const optionDataKey = Symbol('__data');

export type OptData<T> = {
    type: Types;
    labelName: string;
    description: string;
    isRequired: boolean;
    aliases: string[];
    isArray: boolean;
    defaultValue?: T;
    validators: Validator<any>[];
    prePreprocessors: Preprocessor[];
    postPreprocessors: Preprocessor[];
};

export function getOptData(opt: Option<any, any, any, any>) {
    return opt[optionDataKey];
}

export function setOptData(opt: Option<any, any, any, any>, data: OptData<any>) {
    opt[optionDataKey] = data;
}

export function cloneOption<O extends Option<any, any, any, any>>(opt: O): O {
    const oldOpt = opt;
    const oldData = getOptData(oldOpt);
    opt = new Option(oldData.type) as any;
    setOptData(opt, oldData);
    return opt;
}

export function updateOptData<O extends Option<any, any, any, any>>(opt: O, data: Partial<OptData<any>>) {
    return changeOptData(cloneOption(opt), data);
}

export function changeOptData<O extends Option<any, any, any, any>>(opt: O, data: Partial<OptData<any>>) {
    setOptData(opt, {
        ...getOptData(opt),
        ...data
    });
    return opt;
}

export function option<T extends Types>(type: T) {
    return new Option<T, false, false, ResolveType<T>>(type);
}

export class Option<T extends Types, R extends boolean, A extends boolean, RT> {
    name: string = '';
        [optionDataKey]: OptData<RT> = {
        type: 'any',
        labelName: 'any',
        description: '',
        isRequired: false,
        aliases: [],
        isArray: false,
        defaultValue: undefined,
        validators: [],
        prePreprocessors: [],
        postPreprocessors: [],
    };

    private _isRequired!: R;
    private _isArray!: A;

    constructor(type: T) {
        this[optionDataKey].type = type;
        this[optionDataKey].labelName = type;
        const intrinsicValidator = intrinsicValidators[type];
        if (intrinsicValidator) {
            changeOptData(this, {
                validators: [
                    value => {
                        if (intrinsicValidator(value)) {
                            return;
                        }
                        throw new Error(`expected <${this[optionDataKey].labelName}>, but received <${typeof value}>`);
                    }
                ]
            });
        }
        const intrinsicPreProcessor = intrinsicPreProcessors[type];
        if (intrinsicPreProcessor) {
            changeOptData(this, {
                prePreprocessors: [intrinsicPreProcessor as Preprocessor]
            })
        }
    }

    label(name: string): Option<T, R, A, RT> {
        return updateOptData(this, {
            labelName: name
        });
    }

    alias(...aliases: string[]): Option<T, R, A, RT> {
        return updateOptData(this, {
            aliases: this[optionDataKey].aliases.concat(aliases)
        });
    }

    description(text: string): Option<T, R, A, RT> {
        return updateOptData(this, {
            description: text
        });
    }

    required(): Option<T, true, A, RT> {
        return updateOptData(this, {
            isRequired: true
        }) as any;
    }

    array(): Option<T, R, true, RT> {
        return updateOptData(this, {
            isArray: true
        }) as any;
    }

    default(value: RT): Option<T, true, A, RT> {
        return updateOptData(this, {
            isRequired: false,
            defaultValue: value,
        }) as any;
    }

    validate(errorMsg: string, validator: BooleanValidator<RT>): Option<T, R, A, RT>;
    validate(validator: Validator<RT>): Option<T, R, A, RT>;
    validate(...args: any[]): Option<T, R, A, RT> {
        const validator = args.length === 2
            ? makeValidator(args[0], args[1])
            : args[0];
        return updateOptData(this, {
            validators: getOptData(this).validators.concat(validator),
        });
    }


    process(phase: 'pre', fn: Preprocessor<any, ResolveType<T>>): Option<T, R, A, RT>;
    process<FR>(phase: 'post', fn: Preprocessor<ResolveType<T>, FR>): Option<T, R, A, FR>;
    process(phase: 'pre' | 'post', fn: Preprocessor): Option<T, R, A, RT> {
        switch (phase) {
            case 'pre':
                return updateOptData(this, {
                    prePreprocessors: getOptData(this).prePreprocessors.concat(fn),
                });
            case 'post':
                return updateOptData(this, {
                    postPreprocessors: getOptData(this).postPreprocessors.concat(fn),
                });
            default:
                throw new Error(`unknown phase "${phase}"`);
        }
    }
}

export type OptionSet = Record<string, Option<any, boolean, boolean, any>>;
