# babel-plugin-react-intl-to-properties

Extracts string messages for translation from modules that use [React Intl][] into a .properties file.

## Installation

```sh
$ npm install babel-plugin-react-intl-to-properties
```

## Usage

**This Babel plugin only visits ES6 modules which `import` React Intl.**

The default message descriptors for the app's default language will be extracted from: `defineMessages()`, `<FormattedMessage>`, and `<FormattedHTMLMeessage>`; all of which are named exports of the React Intl package.

### Via `.babelrc` (Recommended)

**.babelrc**

```json
{
  "plugins": [
    ["react-intl", {
        "messagesDir": "./build/messages/",
        "enforceDescriptions": true
    }]
  ]
}
```

#### Options

- **`messagesDir`**: The target location where the plugin will output a `.properties` file corresponding to each component from which React Intl messages were extracted. If not provided, the extracted message descriptors will only be accessible via Babel's API.

- **`enforceDescriptions`**: Whether or not message declarations _must_ contain a `description` to provide context to translators. Defaults to: `false`.

- **`moduleSourceName`**: The ES6 module source name of the React Intl package. Defaults to: `"react-intl"`, but can be changed to another name/path to React Intl.

### Via CLI

```sh
$ babel --plugins react-intl-to-properties script.js
```

[React Intl]: http://formatjs.io/react/
[v2-discussion]: https://github.com/yahoo/react-intl/issues/162
