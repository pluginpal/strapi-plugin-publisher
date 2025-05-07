# strapi-plugin-publisher

A plugin for [Strapi](https://github.com/strapi/strapi) that provides the ability to easily schedule publishing and unpublishing of any content type.

[![Downloads](https://img.shields.io/npm/dm/strapi-plugin-publisher?style=for-the-badge)](https://img.shields.io/npm/dm/strapi-plugin-publisher?style=for-the-badge)
[![Install size](https://img.shields.io/npm/l/strapi-plugin-publisher?style=for-the-badge)](https://img.shields.io/npm/l/strapi-plugin-publisher?style=for-the-badge)
[![Package version](https://img.shields.io/github/v/release/PluginPal/strapi-plugin-publisher?style=for-the-badge)](https://img.shields.io/github/v/release/PluginPal/strapi-plugin-publisher?style=for-the-badge)

## Requirements

The installation requirements are the same as Strapi itself and can be found in the documentation on the [Quick Start](https://strapi.io/documentation/developer-docs/latest/getting-started/quick-start.html) page in the Prerequisites info card.

### Supported Strapi versions

- Strapi ^4.x.x (use `strapi-plugin-publisher@^1`)
- Strapi ^5.2.x (use `strapi-plugin-publisher@^2`)

**NOTE**: While this plugin may work with the older Strapi versions, they are not supported, it is always recommended to use the latest version of Strapi.

## Installation

For Strapi 4.x:
```sh
npm install strapi-plugin-publisher
```

**or**

```sh
yarn add strapi-plugin-publisher
```

For Strapi 5.x:

```sh
npm install strapi-plugin-publisher@2.0.0-beta.9
```

**or**

```sh
yarn add strapi-plugin-publisher@2.0.0-beta.9
```


## Configuration

### Enable the plugin

The plugin configuration is stored in a config file located at ./config/plugins.js. If this file doesn't exists, you will need to create it.


A sample configuration

```javascript
module.exports = ({ env }) => ({
  // ..
	'publisher': {
		enabled: true,
		config: {
			hooks: {
				beforePublish: async ({ strapi, uid, entity }) => {
					console.log('beforePublish');
				},
				afterPublish: async ({ strapi, uid, entity }) => {
					console.log('afterPublish');
				},
				beforeUnpublish: async ({ strapi, uid, entity }) => {
					console.log('beforeUnpublish');
				},
				afterUnpublish: async ({ strapi, uid, entity }) => {
					console.log('afterUnpublish');
				},
			},
		},
	},
	// ..
});
```

### The Complete Plugin Configuration  Object

| Property                         | Description                                                                      | Type     | Default | Required |
|----------------------------------|----------------------------------------------------------------------------------|----------| ------- | -------- |
| actions                          | Settings associated with any actions.                                            | Object   | {} | No |
| actions.syncFrequency            | The frequency to check for actions to run. It is a cron expression               | String   | '*/1 * * * *' | No |
| components                       | Settings associated with any of the plugins components                           | Object   | {} | No |
| components.dateTimePicker        | Settings associated with the DateTimePicker component used to set action times   | Object   | {} | No |
| components.dateTimePicker.step   | The step between the numbers displayed for the time section of the DateTimePicker | Number   | 1 | No |
| components.dateTimePicker.locale | Allows to enforce another locale to change the date layout                       | String   | browser locale | No |
| hooks.beforePublish              | An async function that runs before a content type is published                   | Function | () => {} | No |
| hooks.afterPublish               | An async function that runs after a content type is published                    | Function | () => {} | No |
| hooks.beforeUnpublish            | An async function that runs before a content type is un-published                | Function | () => {} | No |
| hooks.afterUnpublish             | An async function that runs after a content type is un-published                 | Function | () => {} | No |
| contentTypes                     | A list of content type uids where the publish actions should be displayed        | Array<String> | All content types | No |

### Enable server cron

The `cron.enabled` configuration option needs to be set to true in [Server Configuration](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/configurations/required/server.html#server-configuration) for the plugin to work.

## Usage

Once the plugin has been installed, configured and enabled a `Publisher` section will be added to the `informations` section of the edit view for all content types (single + collection) that have `draftAndPublish` enabled. The `Publisher` section will provide the ability to schedule publishing and unpublishing of the content type. The content type publication status is checked every minute.

> If the Publisher section does not appear in the admin after the plugin is enabled then a clean rebuild of the admin is required. This can be done by deleting the generated `.cache` and `build` folders and then re-running the `develop` command. 

### Single Content Type

![Sample single content type publisher section](https://github.com/PluginPal/strapi-plugin-publisher/blob/master/assets/single.png?raw=true)

### Collection Content Type

![Sample collection content type publisher section](https://github.com/PluginPal/strapi-plugin-publisher/blob/master/assets/collection.png?raw=true)

### Adding a (un)publish date

Navigate to the entity record that should be (un)published, under the `informations` section click the `Add a (un)publish date` button. Enter in the date and click save, the entity record will then be (un)published at the specified time.

![default](https://github.com/PluginPal/strapi-plugin-publisher/blob/master/assets/default.png?raw=true)

![Add a (un)publish date](https://github.com/PluginPal/strapi-plugin-publisher/blob/master/assets/add.png?raw=true)

### Editing a (un)publish date

Navigate to the entity record that requires its date changed, under the `informations` section click the `Edit (un)publish date` button. Enter in the new date and click save.

![Edit a (un)publish date](https://github.com/PluginPal/strapi-plugin-publisher/blob/master/assets/edit-delete.png?raw=true)

### Deleting a (un)publish date

Navigate to the entity record that contains the date that should be removed, under the `informations` section click the `Delete (un)publish date` button.

![Delete a (un)publish date](https://github.com/PluginPal/strapi-plugin-publisher/blob/master/assets/edit-delete.png?raw=true)

## Bugs

If any bugs are found please report them as a [Github Issue](https://github.com/PluginPal/strapi-plugin-publisher/issues)
