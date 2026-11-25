import { describe, expect, it } from 'vitest';
import { getTrad } from '../../admin/src/utils/getTrad';
import { prefixPluginTranslations } from '../../admin/src/utils/prefixPluginTranslation';

describe('admin translations', () => {
	it('prefixes every translation key with the plugin id', () => {
		expect(prefixPluginTranslations({ a: 'A', 'action.mode': 'Mode' }, 'publisher')).toEqual({
			'publisher.a': 'A',
			'publisher.action.mode': 'Mode',
		});
	});

	it('refuses an empty plugin id', () => {
		expect(() => prefixPluginTranslations({ a: 'A' }, '')).toThrow("pluginId can't be empty");
	});

	it('looks up translations by their key with the plugin id', () => {
		expect(getTrad('action.mode')).toBe('publisher.action.mode');
	});
});
