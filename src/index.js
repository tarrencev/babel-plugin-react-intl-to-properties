/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import * as p from 'path';
import {appendFileSync, writeFileSync} from 'fs';
import {sync as mkdirpSync} from 'mkdirp';
import printICUMessage from './print-icu-message';

const COMPONENT_NAMES = [
    'FormattedMessage',
    'FormattedHTMLMessage',
];

const FUNCTION_NAMES = [
    'defineMessages',
];

const DESCRIPTOR_PROPS = new Set(['id', 'description', 'defaultMessage']);

const translations = new Map();

export default function ({types: t}) {
    function getModuleSourceName(opts) {
        return opts.moduleSourceName || 'react-intl';
    }

    function getMessageDescriptorKey(path) {
        if (path.isIdentifier() || path.isJSXIdentifier()) {
            return path.node.name;
        }

        let evaluated = path.evaluate();
        if (evaluated.confident) {
            return evaluated.value;
        }

        throw path.buildCodeFrameError(
            '[React Intl] Messages must be statically evaluate-able for extraction.'
        );
    }

    function getMessageDescriptorValue(path) {
        if (path.isJSXExpressionContainer()) {
            path = path.get('expression');
        }

        let evaluated = path.evaluate();
        if (evaluated.confident) {
            return evaluated.value;
        }

        throw path.buildCodeFrameError(
            '[React Intl] Messages must be statically evaluate-able for extraction.'
        );
    }

    function createMessageDescriptor(propPaths, options = {}) {
        const {isJSXSource = false} = options;

        return propPaths.reduce((hash, [keyPath, valuePath]) => {
            let key = getMessageDescriptorKey(keyPath);

            if (!DESCRIPTOR_PROPS.has(key)) {
                return hash;
            }

            let value = getMessageDescriptorValue(valuePath).trim();

            if (key === 'defaultMessage') {
                try {
                    hash[key] = printICUMessage(value);
                } catch (parseError) {
                    if (isJSXSource &&
                        valuePath.isLiteral() &&
                        value.indexOf('\\\\') >= 0) {

                        throw valuePath.buildCodeFrameError(
                            '[React Intl] Message failed to parse. ' +
                            'It looks like `\\`s were used for escaping, ' +
                            'this won\'t work with JSX string literals. ' +
                            'Wrap with `{}`. ' +
                            'See: http://facebook.github.io/react/docs/jsx-gotchas.html'
                        );
                    }

                    throw valuePath.buildCodeFrameError(
                        '[React Intl] Message failed to parse. ' +
                        'See: http://formatjs.io/guides/message-syntax/',
                        parseError
                    );
                }
            } else {
                hash[key] = value;
            }

            return hash;
        }, {});
    }

    function storeMessage({id, description, defaultMessage}, path, state) {
        const {opts, reactIntl} = state;

        if (!(id && defaultMessage)) {
            throw path.buildCodeFrameError(
                '[React Intl] Message Descriptors require an `id` and `defaultMessage`.'
            );
        }

        if (reactIntl.messages.has(id)) {
            let existing = reactIntl.messages.get(id);

            if (description !== existing.description ||
                defaultMessage !== existing.defaultMessage) {

                throw path.buildCodeFrameError(
                    `[React Intl] Duplicate message id: "${id}", ` +
                    'but the `description` and/or `defaultMessage` are different.'
                );
            }
        }

        if (opts.enforceDescriptions && !description) {
            throw path.buildCodeFrameError(
                '[React Intl] Message must have a `description`.'
            );
        }

        reactIntl.messages.set(id, {id, description, defaultMessage});
    }

    function referencesImport(path, mod, importedNames) {
        if (!(path.isIdentifier() || path.isJSXIdentifier())) {
            return false;
        }

        return importedNames.some((name) => path.referencesImport(mod, name));
    }

    function getMessagesFilePath(messagesDir, fileName) {
        return p.join(
            messagesDir,
            fileName + '.properties'
        );
    }

    return {
        visitor: {
            Program: {
                enter(path, state) {
                    state.reactIntl = {
                        messages: new Map(),
                    };
                },

                exit(path, state) {
                    const {file, opts, reactIntl} = state;
                    const {fileName, messagesDir, namespace} = opts;
                    const isNamespaced = !!namespace;

                    const descriptors = [...reactIntl.messages.values()];
                    file.metadata['react-intl'] = {messages: descriptors};

                    const propertiesFilePath = getMessagesFilePath(messagesDir, fileName);

                    if (messagesDir && descriptors.length > 0) {
                        // On each write, we have to clear the properties file. We keep all the
                        // keys we encountered in the `translations` Map.
                        mkdirpSync(messagesDir);
                        writeFileSync(propertiesFilePath, '');

                        descriptors.forEach((descriptor) => {
                            const {defaultMessage, description, id} = descriptor;
                            const cleanedMessage = defaultMessage.replace(/\s+/g, ' ');
                            const cleanedDescription = description.trim().replace(/\s+/g, ' ');

                            if (isNamespaced && id.split('.')[0] !== namespace) {
                                return;
                            }

                            translations.set(id, {
                                value: cleanedMessage,
                                comment: cleanedDescription,
                            });
                        });

                        // When done going through each descriptor, re-write the properties file
                        // with every translation we have seen so far
                        Array.from(translations.keys()).sort().forEach((key) => {
                            const { value, comment } = translations.get(key);
                            const formattedDescription =
                                `# ${comment}
                                ${key} = ${value}
                                `.replace(/^\s+/gm, ''); // Dedent string
                            appendFileSync(propertiesFilePath, formattedDescription);
                        });
                    }
                },
            },

            JSXOpeningElement(path, state) {
                const {file, opts}     = state;
                const moduleSourceName = getModuleSourceName(opts);

                let name = path.get('name');

                if (name.referencesImport(moduleSourceName, 'FormattedPlural')) {
                    file.log.warn(
                        `[React Intl] Line ${path.node.loc.start.line}: ` +
                        'Default messages are not extracted from ' +
                        '<FormattedPlural>, use <FormattedMessage> instead.'
                    );

                    return;
                }

                if (referencesImport(name, moduleSourceName, COMPONENT_NAMES)) {
                    let attributes = path.get('attributes')
                        .filter((attr) => attr.isJSXAttribute());

                    let descriptor = createMessageDescriptor(
                        attributes.map((attr) => [
                            attr.get('name'),
                            attr.get('value'),
                        ]),
                        {isJSXSource: true}
                    );

                    // In order for a default message to be extracted when
                    // declaring a JSX element, it must be done with standard
                    // `key=value` attributes. But it's completely valid to
                    // write `<FormattedMessage {...descriptor} />`, because it
                    // will be skipped here and extracted elsewhere. When the
                    // `defaultMessage` prop exists, the descriptor will be
                    // checked.
                    if (descriptor.defaultMessage) {
                        storeMessage(descriptor, path, state);

                        attributes
                            .filter((attr) => {
                                let keyPath = attr.get('name');
                                let key = getMessageDescriptorKey(keyPath);
                                return key === 'description';
                            })
                            .forEach((attr) => attr.remove());
                    }
                }
            },

            CallExpression(path, state) {
                const moduleSourceName = getModuleSourceName(state.opts);

                function processMessageObject(messageObj) {
                    if (!(messageObj && messageObj.isObjectExpression())) {
                        throw path.buildCodeFrameError(
                            `[React Intl] \`${callee.node.name}()\` must be ` +
                            `called with message descriptors defined as ` +
                            `object expressions.`
                        );
                    }

                    let properties = messageObj.get('properties');

                    let descriptor = createMessageDescriptor(
                        properties.map((prop) => [
                            prop.get('key'),
                            prop.get('value'),
                        ])
                    );

                    if (!descriptor.defaultMessage) {
                        throw path.buildCodeFrameError(
                            '[React Intl] Message is missing a `defaultMessage`.'
                        );
                    }

                    storeMessage(descriptor, path, state);

                    messageObj.replaceWith(t.objectExpression([
                        t.objectProperty(
                            t.stringLiteral('id'),
                            t.stringLiteral(descriptor.id)
                        ),
                        t.objectProperty(
                            t.stringLiteral('defaultMessage'),
                            t.stringLiteral(descriptor.defaultMessage)
                        ),
                    ]));
                }

                let callee = path.get('callee');

                if (referencesImport(callee, moduleSourceName, FUNCTION_NAMES)) {
                    let messagesObj = path.get('arguments')[0];

                    messagesObj.get('properties')
                        .map((prop) => prop.get('value'))
                        .forEach(processMessageObject);
                }
            },
        },
    };
}
