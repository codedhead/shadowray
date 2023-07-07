/* eslint-disable no-useless-escape */
/* eslint-disable quote-props */

import type { languages } from 'monaco-editor-core';

export const conf: languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/']
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string'] }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  folding: {
    markers: {
      start: new RegExp('^\\s*#pragma\\s+region\\b'),
      end: new RegExp('^\\s*#pragma\\s+endregion\\b')
    }
  }
};

export const language = {
  defaultToken: '',
  tokenPostfix: '.glsl',

  keywords: [
    'const', 'attribute', 'uniform', 'varying', 'buffer',
    'break', 'continue', 'discard', 'return',
    'for', 'while', 'do', 'if', 'else', 'struct',
    'in', 'out', 'inout',
    // vulkan
    'layout',
    // ray tracing
    'hitAttributeEXT', 'shaderRecordEXT',
    'rayPayloadEXT', 'rayPayloadInEXT',
  ],
  types: [
    'void', 'bool', 'float', 'uint', 'int',
    'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4',
    'uvec2', 'uvec3', 'uvec4',
    'bvec2', 'bvec3', 'bvec4', 'mat2', 'mat3', 'mat4',
    // vulkan
    'sampler',
    'texture1D', 'texture1DProj', 'texture1DLod', 'texture1DProjLod',
    'texture2D', 'texture2DProj', 'texture2DLod', 'texture2DProjLod',
    'texture3D', 'texture3DProj', 'texture3DLod', 'texture3DProjLod',
    'textureCube', 'textureCubeLod',
    'shadow1D', 'shadow2D', 'shadow1DProj', 'shadow2DProj',
    'shadow1DLod', 'shadow2DLod', 'shadow1DProjLod', 'shadow2DProjLod',
    // ray tracing
    'accelerationStructureEXT',
  ],
  functions: [
    'radians', 'degrees', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'pow', 'exp', 'log', 'exp2', 'sqrt', 'inversesqrt',
    'abs', 'sign', 'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp', 'mix', 'step', 'smoothstep',
    'length', 'distance', 'dot', 'cross', 'normalize', 'ftransform', 'faceforward',
    'reflect', 'refract', 'matrixCompMult',
    'lessThan', 'lessThanEqual', 'greaterThan', 'greaterThanEqual',
    'equal', 'notEqual', 'any', 'all', 'not',
    'dFdx', 'dFdy', 'fwidth',
    'noise1', 'noise2', 'noise3', 'noise4',
    // vulkan
    'texture',
    'sampler1D', 'sampler2D', 'sampler3D', 'samplerCube',
    'sampler1DShadow', 'sampler2DShadow',
  ],
  values: [
    'true', 'false',
    'gl_FragColor', 'gl_SecondaryColor', 'gl_Normal', 'gl_Vertex',
    'gl_MultiTexCoord0', 'gl_MultiTexCoord1', 'gl_MultiTexCoord2', 'gl_MultiTexCoord3',
    'gl_MultiTexCoord4', 'gl_MultiTexCoord5', 'gl_MultiTexCoord6', 'gl_MultiTexCoord7',
    'gl_FogCoord', 'gl_PointCoord',
    'gl_Position', 'gl_PointSize', 'gl_ClipVertex',
    'gl_FrontColor', 'gl_BackColor', 'gl_FrontSecondaryColor', 'gl_BackSecondaryColor',
    'gl_TexCoord', 'gl_FogFragCoord',
    'gl_FragCoord', 'gl_FrontFacing',
    'gl_FragData', 'gl_FragDepth',
    'gl_ModelViewMatrix', 'gl_ProjectionMatrix', 'gl_ModelViewProjectionMatrix',
    'gl_TextureMatrix', 'gl_NormalMatrix', 'gl_ModelViewMatrixInverse',
    'gl_ProjectionMatrixInverse', 'gl_ModelViewProjectionMatrixInverse',
    'gl_TextureMatrixTranspose', 'gl_ModelViewMatrixInverseTranspose',
    'gl_ProjectionMatrixInverseTranspose',
    'gl_ModelViewProjectionMatrixInverseTranspose',
    'gl_TextureMatrixInverseTranspose',
    'gl_NormalScale', 'gl_DepthRange', 'gl_ClipPlane',
    'gl_Point', 'gl_FrontMaterial', 'gl_BackMaterial', 'gl_LightSource', 'gl_LightModel',
    'gl_FrontLightModelProduct', 'gl_BackLightModelProduct',
    'gl_TextureColor', 'gl_EyePlaneS', 'gl_EyePlaneT', 'gl_EyePlaneR', 'gl_EyePlaneQ',
    'gl_FogParameters',
    'gl_MaxLights', 'gl_MaxClipPlanes', 'gl_MaxTextureUnits', 'gl_MaxTextureCoords',
    'gl_MaxVertexAttribs', 'gl_MaxVertexUniformComponents', 'gl_MaxVaryingFloats',
    'gl_MaxVertexTextureImageUnits', 'gl_MaxTextureImageUnits',
    'gl_MaxFragmentUniformComponents', 'gl_MaxCombineTextureImageUnits',
    'gl_MaxDrawBuffers',
    // ray tracing
    'traceRayEXT', 'terminateRayEXT', 'ignoreIntersectionEXT', 'reportIntersectionEXT',
    'gl_ObjectRayOriginEXT', 'gl_ObjectRayDirectionEXT',
    'gl_WorldRayOriginEXT', 'gl_WorldRayDirectionEXT',
  ],

  operators: [
    '=',
    '>',
    '<',
    '!',
    '~',
    '?',
    ':',
    '==',
    '<=',
    '>=',
    '!=',
    '&&',
    '||',
    '++',
    '--',
    '+',
    '-',
    '*',
    '/',
    '&',
    '|',
    '^',
    '%',
    '<<',
    '>>',
    '>>>',
    '+=',
    '-=',
    '*=',
    '/=',
    '&=',
    '|=',
    '^=',
    '%=',
    // '<<=',
    // '>>=',
    // '>>>='
  ],

  // we include these common regular expressions
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  integersuffix: /(ll|LL|u|U|l|L)?(ll|LL|u|U|l|L)?/,
  floatsuffix: /[fFlL]?/,
  encoding: /u|u8|U|L/,

  // The main tokenizer for our languages
  tokenizer: {
    root: [
      // identifiers and keywords
      [
        /([a-zA-Z_]\w*)(\()?/,
        {
          cases: {
            '$1@keywords': {
              cases: {
                '$2': ['keyword.$1', ''], //{ token: 'keyword.$1', goBack: 1 },
                '@default': 'keyword.$1',
              }
            },
            '$1@types': {
              cases: {
                '$2': ['type', ''],
                '@default': 'type',
              }
            },
            '$1@functions': {
              cases: {
                '$2': ['string', ''], // TODO: looks nicer here, entity.name.function
                '@default': 'string',
              }
            },
            '$1@values': {
              cases: {
                '$2==(': ['constant.language', ''],
                // '$2==.': ['constant.language', { token: '', next: '@property' }],
                '@default': 'constant.language',
              }
            },
            '$2==(': ['string', ''], // entity.name.function
            // '$2==.': ['identifier', { token: '', next: '@property' }],
            '@default': 'identifier'
          }
        }
      ],

      // The preprocessor checks must be before whitespace as they check /^\s*#/ which
      // otherwise fails to match later after other whitespace has been removed.

      // Inclusion
      [/^\s*#\s*include/, { token: 'keyword.directive.include', next: '@include' }],

      // Preprocessor directive
      [/^\s*#\s*\w+/, 'keyword.directive'],

      // whitespace
      { include: '@whitespace' },

      // delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'delimiter',
            '@default': ''
          }
        }
      ],

      // numbers
      [/\d*\d+[eE]([\-+]?\d+)?(@floatsuffix)/, 'number.float'],
      [/\d*\.\d+([eE][\-+]?\d+)?(@floatsuffix)/, 'number.float'],
      [/0[xX][0-9a-fA-F']*[0-9a-fA-F](@integersuffix)/, 'number.hex'],
      [/0[0-7']*[0-7](@integersuffix)/, 'number.octal'],
      [/0[bB][0-1']*[0-1](@integersuffix)/, 'number.binary'],
      [/\d[\d']*\d(@integersuffix)/, 'number'],
      [/\d(@integersuffix)/, 'number'],

      // delimiter: after number because of .\d floats
      [/[;,]/, 'delimiter'], // .

      [/[.]/, 'delimiter', '@property'],

      // strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/"/, 'string', '@string'],

      // characters
      [/'[^\\']'/, 'string'],
      [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
      [/'/, 'string.invalid']
    ],

    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/\/\*\*(?!\/)/, 'comment.doc', '@doccomment'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*\\$/, 'comment', '@linecomment'],
      [/\/\/.*$/, 'comment']
    ],

    comment: [
      [/[^\/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment']
    ],

    //For use with continuous line comments
    linecomment: [
      [/.*[^\\]$/, 'comment', '@pop'],
      [/[^]+/, 'comment']
    ],

    //Identical copy of comment above, except for the addition of .doc
    doccomment: [
      [/[^\/*]+/, 'comment.doc'],
      [/\*\//, 'comment.doc', '@pop'],
      [/[\/*]/, 'comment.doc']
    ],

    property: [
      [/([a-zA-Z_]\w*)(\()/, ['string', { token: '', next: '@pop' }]], // entity.name.function
      [/([a-zA-Z_]\w*)/, 'variable.other.property'],
      [/\./, 'delimiter'],
      [/$/, { token: '', next: '@pop' }],
      [/./, { token: '', next: '@pop', goBack: 1 }],
    ],

    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop']
    ],

    raw: [
      [
        /(.*)(\))(?:([^ ()\\\t"]*))(\")/,
        {
          cases: {
            '$3==$S2': [
              'string.raw',
              'string.raw.end',
              'string.raw.end',
              { token: 'string.raw.end', next: '@pop' }
            ],
            '@default': ['string.raw', 'string.raw', 'string.raw', 'string.raw']
          }
        }
      ],
      [/.*/, 'string.raw']
    ],

    include: [
      [
        /(\s*)(<)([^<>]*)(>)/,
        [
          '',
          'keyword.directive.include.begin',
          'string.include.identifier',
          { token: 'keyword.directive.include.end', next: '@pop' }
        ]
      ],
      [
        /(\s*)(")([^"]*)(")/,
        [
          '',
          'keyword.directive.include.begin',
          'string.include.identifier',
          { token: 'keyword.directive.include.end', next: '@pop' }
        ]
      ]
    ]
  }
} as languages.IMonarchLanguage;