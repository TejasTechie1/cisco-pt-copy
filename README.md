# Network Simulator

A web-based network simulator with a React/TypeScript frontend and Node.js/Express backend, organized as a monorepo using pnpm workspaces.

## 🏗️ Project Structure

```
network-simulator/
├── packages/
│   ├── frontend/          # React + TypeScript + Vite + Tailwind CSS
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── test/
│   │   │   ├── App.tsx
│   │   │   ├── App.test.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── backend/           # Express + TypeScript + ts-node-dev
│       ├── src/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── middleware/
│       │   └── index.ts
│       ├── vitest.config.ts
│       ├── .env.example
│       └── package.json
│
├── .github/
│   └── workflows/
│       └── ci.yml         # CI/CD pipeline (lint, test, build)
│
├── pnpm-workspace.yaml    # pnpm workspace configuration
├── tsconfig.base.json     # Shared TypeScript configuration
├── .eslintrc.json         # ESLint configuration
├── .prettierrc.json       # Prettier configuration
├── package.json           # Root package.json with scripts
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

To install pnpm globally:
```bash
npm install -g pnpm
```

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd network-simulator
```

2. Install dependencies:
```bash
pnpm install
```

## 📜 Available Scripts

### Root Level Commands

Run these from the project root:

```bash
# Start both frontend and backend in development mode
pnpm dev

# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Lint all packages
pnpm lint

# Format code using Prettier
pnpm format

# Check code formatting
pnpm format:check

# Type check all packages
pnpm typecheck

# Clean all build artifacts and node_modules
pnpm clean
```

### Frontend Commands

Run from `packages/frontend` or use `pnpm --filter @network-simulator/frontend <command>`:

```bash
# Start development server (http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

### Backend Commands

Run from `packages/backend` or use `pnpm --filter @network-simulator/backend <command>`:

```bash
# Start development server (http://localhost:3001)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Vitest** - Unit testing framework
- **React Testing Library** - Component testing utilities

### Backend
- **Express** - Web framework
- **TypeScript** - Type-safe JavaScript
- **ts-node-dev** - Development server with auto-reload
- **Vitest** - Unit testing framework
- **Supertest** - HTTP assertions for API testing
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

### Development Tools
- **pnpm** - Fast, disk space efficient package manager
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitHub Actions** - CI/CD pipeline

## 🔧 Development Workflow

1. **Start Development Servers**:
   ```bash
   pnpm dev
   ```
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

2. **Make Changes**: Edit files in `packages/frontend` or `packages/backend`

3. **Run Tests**:
   ```bash
   pnpm test
   ```

4. **Lint and Format**:
   ```bash
   pnpm lint
   pnpm format
   ```

5. **Type Check**:
   ```bash
   pnpm typecheck
   ```

## 🧪 Testing

The project uses Vitest for testing in both frontend and backend packages.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter @network-simulator/frontend test

# Run tests with coverage
pnpm --filter @network-simulator/backend test:coverage
```

### Writing Tests

- Frontend tests: Use React Testing Library and place tests next to components as `*.test.tsx`
- Backend tests: Place tests next to the code being tested as `*.test.ts`

## 🔄 CI/CD

The project includes a GitHub Actions workflow that runs on every push and pull request:

- ✅ Linting
- ✅ Code formatting check
- ✅ Type checking
- ✅ Unit tests
- ✅ Build verification

The CI pipeline runs on Node.js 18.x and 20.x to ensure compatibility.

## 📝 Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for TypeScript with recommended rules
- **Prettier**: Enforced code formatting
- **Naming Conventions**: 
  - Use camelCase for variables and functions
  - Use PascalCase for components and classes
  - Use UPPER_CASE for constants

## 🌐 API Proxy

The frontend Vite dev server is configured to proxy API requests to the backend:

- All requests to `/api/*` are forwarded to `http://localhost:3001`
- This avoids CORS issues during development

## 📦 Adding Dependencies

```bash
# Add to frontend
pnpm --filter @network-simulator/frontend add <package>

# Add to backend
pnpm --filter @network-simulator/backend add <package>

# Add to root (dev dependencies)
pnpm add -Dw <package>
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Ensure all tests pass: `pnpm test`
4. Ensure linting passes: `pnpm lint`
5. Ensure formatting is correct: `pnpm format:check`
6. Ensure type checking passes: `pnpm typecheck`
7. Submit a pull request

## 📄 License

MIT
