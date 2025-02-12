# Contributing to Strapi Publisher Plugin

We appreciate your interest in contributing to the **Strapi Publisher Plugin**! 🚀
This document outlines the guidelines for contributing to this project.

## 🏛 Community Guidelines
We strive to maintain a welcoming and inclusive environment. Please be respectful and follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/).

---

## 🔧 Development Workflow
This plugin uses **Yalc** to test changes in a separate Strapi instance. Instead of a built-in playground, you'll need to link your plugin to a Strapi project using **Yalc**.

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

### 4️⃣ Link the plugin using **Yalc**
You'll need **Yalc** to test the plugin in a separate Strapi project.

1. **Install Yalc** globally (if you haven't already):
   ```bash
   npm i -g yalc
   ```

2. **Publish the plugin to Yalc**:
   ```bash
   yalc publish
   ```

3. **Go to your Strapi test project** (the project where you want to test the plugin):
   ```bash
   cd /path/to/your-strapi-project
   ```

4. **Link the plugin in your Strapi test project**:
   ```bash
   yalc link strapi-plugin-publisher
   ```

### 5️⃣ Watch for changes
Go back to the **plugin's repository** and run:
```bash
yarn run watch:link
```
This will automatically recompile changes and update the plugin inside your Strapi test project.

### 6️⃣ Start your Strapi test project
In your **Strapi test project**, start the development environment:
```bash
yarn develop
```
Now, you should see the **Publisher Plugin** available in your Strapi admin panel.

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
