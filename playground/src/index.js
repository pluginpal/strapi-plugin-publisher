const DEFAULT_ADMIN = {
	email: 'admin@playground.test',
	password: 'Playground123!',
};

/**
 * Create a super admin on the first start so the playground can be used right away.
 * Credentials can be overridden with PLAYGROUND_ADMIN_EMAIL / PLAYGROUND_ADMIN_PASSWORD.
 */
const ensureAdminUser = async (strapi) => {
	const userService = strapi.service('admin::user');
	if (await userService.exists()) {
		return;
	}

	const superAdminRole = await strapi.service('admin::role').getSuperAdmin();
	if (!superAdminRole) {
		return;
	}

	const email = process.env.PLAYGROUND_ADMIN_EMAIL || DEFAULT_ADMIN.email;
	await userService.create({
		email,
		firstname: 'Playground',
		lastname: 'Admin',
		password: process.env.PLAYGROUND_ADMIN_PASSWORD || DEFAULT_ADMIN.password,
		isActive: true,
		registrationToken: null,
		roles: [superAdminRole.id],
	});

	strapi.log.info(`[playground] Created super admin ${email} (see playground/.env.example for the password)`);
};

const seo = (metaTitle, metaDescription) => ({ metaTitle, metaDescription, noIndex: false });
const link = (label, url, openInNewTab = false) => ({ label, url, openInNewTab });
const richText = (body) => ({ __component: 'blocks.rich-text', body });
const quote = (text, author) => ({ __component: 'blocks.quote', quote: text, author });
const callToAction = (title, text, links) => ({ __component: 'blocks.call-to-action', title, text, links });

/**
 * The second locale of the localized Page type (`en` is Strapi's default locale).
 */
const ensureLocales = async (strapi) => {
	const locales = strapi.plugin('i18n').service('locales');
	if (!(await locales.findByCode('nl'))) {
		await locales.create({ code: 'nl', name: 'Dutch (nl)' });
		strapi.log.info('[playground] Created the nl locale');
	}
};

/**
 * Authors and categories that articles relate to (no draft & publish).
 */
const seedRelations = async (strapi) => {
	const authors = strapi.documents('api::author.author');
	const categories = strapi.documents('api::category.category');
	if ((await authors.count()) === 0) {
		await authors.create({ data: { name: 'Ada Writer', email: 'ada@playground.test', bio: 'Writes about Strapi.' } });
		await authors.create({ data: { name: 'Bram Editor', email: 'bram@playground.test' } });
		strapi.log.info('[playground] Seeded authors');
	}
	if ((await categories.count()) === 0) {
		for (const name of ['News', 'Tutorials', 'Releases']) {
			await categories.create({ data: { name } });
		}
		strapi.log.info('[playground] Seeded categories');
	}
	return {
		authors: await authors.findMany({ sort: 'name' }),
		categories: await categories.findMany({ sort: 'name' }),
	};
};

/**
 * Draft articles with relations, a component and a dynamic zone. The required manyToOne `author`
 * relation is filled on the complete articles (regression coverage for scheduling entries whose
 * required to-one relation is filled, #240). "Incomplete article" misses its required author and
 * SEO component (and has an empty required block field), so scheduling it to be published shows
 * validation errors.
 */
const seedArticles = async (strapi, { authors, categories }) => {
	const articles = strapi.documents('api::article.article');
	if ((await articles.count()) > 0) return;

	const [ada, bram] = authors;
	const [news, releases, tutorials] = categories;
	const connect = (...entries) => ({ connect: entries.map(({ documentId }) => ({ documentId })) });

	await articles.create({
		data: {
			title: 'Scheduling publish dates in Strapi',
			excerpt: 'How to plan when content goes live.',
			author: connect(ada),
			categories: connect(tutorials),
			seo: seo('Scheduling publish dates', 'Plan when your Strapi content is published.'),
			blocks: [
				richText('## Why schedule?\n\nSo content goes live at the right **moment**.'),
				quote('Timing is everything.', 'Ada Writer'),
				callToAction('Try it yourself', 'Open an article and pick a publish date.', [
					link('Read the docs', 'https://docs.strapi.io', true),
				]),
			],
		},
	});
	await articles.create({
		data: {
			title: 'Release notes',
			excerpt: 'What changed in the latest release.',
			author: connect(bram),
			categories: connect(news, releases),
			seo: seo('Release notes', 'Everything new in this release.'),
			blocks: [richText('- Scheduled publishing\n- Scheduled unpublishing')],
		},
	});
	await articles.create({
		data: {
			title: 'Incomplete article',
			excerpt:
				'Has no author, no SEO and an empty quote, so it cannot be scheduled for publishing.',
			blocks: [
				richText('Fill in the required fields before scheduling.'),
				{ __component: 'blocks.quote', author: 'Nobody' },
			],
		},
	});
	strapi.log.info('[playground] Seeded draft articles');
};

const seedHomepage = async (strapi) => {
	const homepage = strapi.documents('api::homepage.homepage');
	if ((await homepage.count()) > 0) return;

	await homepage.create({
		data: {
			title: 'Playground homepage',
			intro: 'Draft homepage content.',
			hero: {
				heading: 'Welcome to the playground',
				subheading: 'A single type with components and a dynamic zone.',
				callToAction: link('Read the articles', '/articles'),
			},
			sections: [
				richText('This homepage is a **draft** until it is published.'),
				callToAction('Stay up to date', null, [link('News', '/news'), link('Releases', '/releases')]),
			],
			seo: seo('Playground', 'The homepage of the publisher playground.'),
		},
	});
	strapi.log.info('[playground] Seeded draft homepage');
};

/**
 * Localized pages: "About us" and "Contact" in en and nl, "Nieuws" in nl only.
 */
const seedPages = async (strapi) => {
	const pages = strapi.documents('api::page.page');
	if ((await pages.count({ locale: '*' })) > 0) return;

	const page = (title, intro, faq = []) => ({
		title,
		seo: seo(title, intro),
		sections: [
			{ __component: 'blocks.hero', heading: title, subheading: intro },
			richText(intro),
		],
		faq,
	});

	const about = await pages.create({
		locale: 'en',
		data: page('About us', 'Who we are and what we do.', [
			{ question: 'Who maintains this plugin?', answer: 'PluginPal and its contributors.' },
		]),
	});
	await pages.update({
		documentId: about.documentId,
		locale: 'nl',
		data: page('Over ons', 'Wie we zijn en wat we doen.', [
			{ question: 'Wie onderhoudt deze plugin?', answer: 'PluginPal en de contributors.' },
		]),
	});

	const contact = await pages.create({
		locale: 'en',
		data: page('Contact', 'How to reach us.'),
	});
	await pages.update({
		documentId: contact.documentId,
		locale: 'nl',
		data: page('Contact', 'Zo bereik je ons.'),
	});

	await pages.create({
		locale: 'nl',
		data: page('Nieuws', 'Alleen beschikbaar in het Nederlands.'),
	});
	strapi.log.info('[playground] Seeded draft pages (en, nl)');
};

/**
 * Seed drafts so there is something to schedule.
 */
const seedContent = async (strapi) => {
	await ensureLocales(strapi);
	const relations = await seedRelations(strapi);
	await seedArticles(strapi, relations);
	await seedHomepage(strapi);
	await seedPages(strapi);
};

module.exports = {
	register() {},

	async bootstrap({ strapi }) {
		await ensureAdminUser(strapi);
		await seedContent(strapi);
	},
};
