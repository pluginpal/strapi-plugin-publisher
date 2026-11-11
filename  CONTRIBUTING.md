# Contributing to Strapi Publisher Plugin

We appreciate your interest in contributing to the **Strapi Publisher Plugin**! 🚀
This document outlines the guidelines for contributing to this project.

## 🏛 Community Guidelines
We strive to maintain a welcoming and inclusive environment. Please be respectful and follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/).

---

## 🔧 Development Workflow
This repository contains a **playground**: a small Strapi app in the [`playground`](./playground) folder that loads the plugin straight from this repository. You don't need a separate Strapi project or Yalc to test your changes.

### 1️⃣ Fork the repository
[Go to the repository](https://github.com/pluginpal/strapi-plugin-publisher) and fork it to your own GitHub account.

### 2️⃣ Clone your fork
```bash
git clone git@github.com:YOUR_USERNAME/strapi-plugin-publisher.git
```

### 3️⃣ Install dependencies
Navigate into the project directory and install dependencies:
```bash
cd strapi-plugin-publisher && yarn install
```
This also installs everything the playground needs. Don't run `yarn install` inside the `playground` folder: the plugin and the playground have to share a single copy of Strapi and React.

### 4️⃣ Start the playground
```bash
yarn develop
```
This single command:
- builds the plugin and rebuilds it on every change (`strapi-plugin watch`);
- starts the playground with `strapi develop` once the first build is ready;
- restarts Strapi when the plugin's **server** code is rebuilt. **Admin** changes are reloaded by the admin dev server.

Open [http://localhost:1337/admin](http://localhost:1337/admin) and log in with the super admin that is created on the first start:

| Email | Password |
|-------|----------|
| `admin@playground.test` | `Playground123!` |

The playground comes with an **Article** collection type and a **Homepage** single type, both with draft & publish enabled and seeded with draft content, so you can schedule (un)publish actions right away. The publisher hooks in [`playground/config/plugins.js`](./playground/config/plugins.js) log every (un)publish to the terminal.

### 🛠 Playground commands
| Command | Description |
|---------|-------------|
| `yarn develop` | Build/watch the plugin and run the playground |
| `yarn playground:reset` | Delete the playground database (`playground/.tmp`) to start fresh |
| `yarn playground:strapi <command>` | Run any Strapi CLI command in the playground, e.g. `yarn playground:strapi console` |

To change the port or the admin credentials, copy `playground/.env.example` to `playground/.env`. The admin credentials are only used when the database has no admin user yet, so run `yarn playground:reset` after changing them.

### 🔗 Testing in your own Strapi project (optional)
To test the plugin in another Strapi project, you can still use [Yalc](https://github.com/wclr/yalc). Install it globally first:
```bash
npm i -g yalc
```
Then run this in the plugin repository:
```bash
yarn watch:link
```
and in your Strapi project:
```bash
npx yalc add --link strapi-plugin-publisher && yarn install && yarn develop
```

---

## ✅ Commit Message Convention
We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format:
- `fix`: Bug fixes (e.g., `fix: resolve issue with publish scheduling`)
- `feat`: New features (e.g., `feat: add new logging system`)
- `refactor`: Code improvements without functional changes
- `docs`: Documentation updates
- `chore`: Tooling or maintenance changes

Example:
```bash
git commit -m "feat: add support for multiple publish schedules"
```

---

## 🔍 Linting
We use [ESLint](https://eslint.org/) to enforce coding standards.

### 🛠 Useful Commands:
| Command | Description |
|---------|-------------|
| `yarn lint` | Run ESLint to check for linting issues |
| `yarn lint:fix` | Auto-fix ESLint issues |

---

## 📬 Submitting a Pull Request
> **First time contributing?** Check out [this guide](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github).

### 🔹 Guidelines:
- Keep pull requests **small and focused on a single change**.
- Ensure **ESLint passes** before submitting.
- If updating the UI, include **screenshots**.
- Follow the **Pull Request Template** when submitting a PR.
- **Discuss major API changes** with maintainers by opening an issue first.

---

## 🐞 Reporting Bugs
If you find a bug, please **create an issue** on GitHub:
- **Clearly describe the problem**
- Include **steps to reproduce**
- Attach **screenshots/logs if possible**

[Create a new issue](https://github.com/pluginpal/strapi-plugin-publisher/issues/new).

---

## 💡 Feature Requests
If you have an idea for a **new feature**, open an issue and describe:
- **Why is this feature needed?**
- **How would it work?**

Feature requests should **align with the plugin's goals**.

---

Thank you for contributing! 🎉
