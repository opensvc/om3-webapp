

# 🧾 React File Naming Conventions (JavaScript Version)

Consistent file naming helps keep your React codebase clean, organized, and easy to navigate. Here's a guide tailored for JavaScript-based React projects.

---

## 📁 File Naming by Type

| File Type                       | Naming Convention         | Example                           |
|---------------------------------|---------------------------|-----------------------------------|
| **Component**                   | PascalCase                | `UserProfile.jsx`                 |
| **Hook**                        | camelCase                 | `useAuth.js`                      |
| **Service / API**               | kebab-case                | `auth-service.js`                 |
| **Utility / Helper**            | kebab-case                | `format-date.js`                  |
| **Page Component**              | PascalCase                | `DashboardPage.jsx`               |
| **Stylesheets**                 | kebab-case                | `user-profile.module.css`         |
| **Context File**                | camelCase                 | `authContext.js`                  |
| **Test File**                   | Match target + `.test.js` | `UserProfile.test.js`             |
| **PropTypes** (optional)        | kebab-case or colocated   | `user-prop-types.js` or inline    |
| **General config**              | kebab-case                | app-config.js or config.js        |
| **Environment config**          | dot + kebab-case          | .env, .env.local, .env.production |
| **Build config (Vite/Webpack)** | kebab-case                | vite.config.js, webpack.config.js |
| **Linting config**              | dotfile or kebab          | .eslintrc.js, eslint.config.js    |
| **Formatter config**            | dotfile                   | .prettierrc, .prettierrc.js       |
| **Jest config**                 | kebab-case or default     | jest.config.js                    |
| **Babel config**                | dotfile or kebab          | babel.config.js, .babelrc         |
| **TS Config (if used)**         | kebab-case                | tsconfig.json                     |


---

## 🗂 Suggested src Folder Structure

````markdown
src/
├── components/
│   ├── UserCard/
│   │   ├── UserCard.jsx
│   │   ├── user-card.module.css
│   │   └── UserCard.test.js
├── pages/
│   ├── HomePage.jsx
│   └── DashboardPage.jsx
├── hooks/
│   ├── useAuth.js
│   └── useFetch.js
├── services/
│   ├── auth-service.js
│   └── user-service.js
├── utils/
│   ├── format-date.js
│   └── validate-email.js
├── context/
│   └── authContext.js
└── App.jsx
````

## 🗂 Suggested react Folder Structure

````markdown
my-react-app/
├── public/
├── src/
├── .env
├── .gitignore
├── package.json
├── vite.config.js
├── .eslintrc.js
├── .prettierrc
├── jest.config.js
├── babel.config.js
└── README.md
````

---

## 🧠 Quick Rules

- Use **PascalCase** for React components (matches JSX syntax: `<UserProfile />`)
- Use **camelCase** for hooks and context files (`useAuth.js`, `authContext.js`)
- Use **kebab-case** for services, utilities, and styles (`auth-service.js`, `format-date.js`)
- Keep test files next to the file they test (`Component.test.js`)

---

## ✅ Tips

- Be consistent across your team or project.
- Use folders like `components/`, `hooks/`, `services/`, `utils/`, etc. for better separation of concerns.
- You can colocate related files (styles, tests) with components inside their own folder.
