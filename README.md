# babel-plugin-react-intl-to-properties

Extracts string messages for translation from modules that use [React Intl][] into a `.properties` file.

## Installation

```sh
$ npm install babel-plugin-react-intl-to-properties
```

## Example

##### Formatted Message

```js
  <FormattedMessage
        defaultMessage='React Intl to Properties'
        description='Title for React Intl to Properties'
        id='example.rectintltoprops'
    />
```

##### Outputted `.properties`

```properties
# Title for React Intl to Properties
example.rectintltoprops=React Intl to Properties
```


## Usage

The default message descriptors for the app's default language will be extracted from: `defineMessages()`, `<FormattedMessage>`, and `<FormattedHTMLMeessage>`; all of which are named exports of the React Intl package.

##### `.babelrc`

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

##### Options

- **`enforceDescriptions`**: Whether or not message declarations _must_ contain a `description` to provide context to translators. Defaults to: `false`.

- **`messagesDir`**: The target location where the plugin will output a `.properties` file corresponding to each component from which React Intl messages were extracted. If not provided, the extracted message descriptors will only be accessible via Babel's API.

- **`moduleSourceName`**: The ES6 module source name of the React Intl package. Defaults to: `"react-intl"`, but can be changed to another name/path to React Intl.

- **`namespace`**: Only extract messages with a particular namespaced `id` in the form `<namespace>.id`. Useful when including external components with their own `messages`.

##### Via CLI

```sh
$ babel --plugins react-intl-to-properties script.js
```

[React Intl]: http://formatjs.io/react/
[v2-discussion]: https://github.com/yahoo/react-intl/issues/162

## Credit

Forked from [yahoo/babel-plugin-react-intl](https://github.com/yahoo/babel-plugin-react-intl)
