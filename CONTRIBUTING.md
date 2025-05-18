# Contributing to Walia

Thank you for your interest in contributing to Walia! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct: Be respectful, considerate, and collaborative.

## How to Contribute

### Prerequisites

- Node.js (version 16.x or higher)
- npm (comes with Node.js)

### Setting Up the Development Environment

1. Fork the repository
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/Walia.git
   cd Walia
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a new branch for your contribution:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Workflow

1. Make your changes
2. Run the tests to ensure everything works:
   ```bash
   # Run wallet management tests
   npx vitest run src/__tests__/wallet-demo.test.ts src/__tests__/wallet-advanced.test.ts
   ```
3. Build the project:
   ```bash
   npm run build
   ```

### Submitting Changes

1. Commit your changes:
   ```bash
   git commit -m "Description of your changes"
   ```
2. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Open a pull request against the main repository

## Testing

We use Vitest for testing. Tests should be written for all new features and bug fixes.

```bash
# Run specific tests
npx vitest run src/__tests__/wallet-demo.test.ts

# Run all tests
npm test
```

## Code Style

- We use TypeScript for type safety
- Follow the existing code style
- Use descriptive variable names
- Add comments for complex logic

## Pull Request Process

1. Ensure your code passes all tests
2. Update documentation if necessary
3. The PR should be focused on a single feature or bug fix
4. Your PR will be reviewed by maintainers who may request changes

## License

By contributing to this project, you agree that your contributions will be licensed under the project's license. 