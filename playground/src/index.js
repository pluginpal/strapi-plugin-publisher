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

/**
 * Seed a few drafts so there is something to schedule.
 * Articles have a required manyToOne `author` relation (regression coverage for scheduling
 * entries whose required to-one relation is filled).
 */
const seedContent = async (strapi) => {
	const authors = strapi.documents('api::author.author');
	if ((await authors.count()) === 0) {
		await authors.create({ data: { name: 'Ada Writer', email: 'ada@playground.test' } });
		strapi.log.info('[playground] Seeded author');
	}
	const [author] = await authors.findMany({ sort: 'name' });

	const articles = strapi.documents('api::article.article');
	if ((await articles.count({ status: 'draft' })) === 0) {
		for (const title of ['First playground article', 'Second playground article']) {
			await articles.create({
				data: {
					title,
					content: `Content of "${title}".`,
					author: { connect: [{ documentId: author.documentId }] },
				},
			});
		}
		strapi.log.info('[playground] Seeded draft articles');
	}

	const homepage = strapi.documents('api::homepage.homepage');
	if ((await homepage.count({ status: 'draft' })) === 0) {
		await homepage.create({
			data: { title: 'Playground homepage', intro: 'Draft homepage content.' },
		});
		strapi.log.info('[playground] Seeded draft homepage');
	}
};

module.exports = {
	register() {},

	async bootstrap({ strapi }) {
		await ensureAdminUser(strapi);
		await seedContent(strapi);
	},
};
