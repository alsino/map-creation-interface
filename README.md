# EU Map Visualization Application

## Overview

This is a SvelteKit-powered interactive map visualization application specifically designed for European Union country data. The application provides a comprehensive control panel for configuring and customizing map visualizations, with a unique one-click deployment feature.

<img width="1552" alt="Bildschirmfoto 2025-01-17 um 09 47 40" src="https://github.com/user-attachments/assets/9d7ffc73-a758-48b4-99e0-4ee6326e836d" />

## Key Features

### Data Visualization

- Interactive map of European Union countries
- Supports various dataset types (values, binary)
- Flexible data input via CSV
- Multiple color scheme options

### Deployment Capabilities

- One-click repository creation and deployment
- Automatic GitHub repository setup
- Instant Vercel deployment
- Batch translation file processing
- Embed code generation for easy sharing

### Customization Options

- Configurable title and subtitle
- Customizable data sources and notes
- Multiple display options:
  - Tooltips
  - Legend
  - Scale bar
- Color scheme selection:
  - Sequential and diverging color schemes
  - Color scheme reversal
  - Custom number of color classes

### Translation Support

- Automatic translation of map text to multiple languages
- Translation progress tracking
- Support for 24 languages

## Prerequisites

- Node.js (version 16 or later)
- npm or pnpm
- GitHub account
- Vercel account
- A modern web browser

## Technologies Used

- SvelteKit
- Tailwind CSS
- D3.js (for CSV parsing)
- Custom translation API
- GitHub API
- Vercel Deployment API
- Responsive design

## Deployment Workflow and API Sequence

### API Call Sequence

The deployment process involves a carefully orchestrated sequence of API calls, each handling a specific phase of the map creation and deployment:

#### 1. Translation API `/api/translate`

- **Purpose**: Generate multilingual translations for map content
- **Input**:
  - `sourceObject`: Original text content to translate
  - `batchIndex`: Current processing batch
- **Processing Strategy**:
  - Supports 24 languages
  - Batch-based translation processing
  - Incremental translation generation
- **Features**:
  - Translates map title, subtitle, descriptions
  - Handles text content, source information, notes
  - Provides progress tracking
- **Output**:
  - `translations`: Object containing translations for multiple languages
  - `completedLanguages`: List of languages processed in current batch
  - `hasMore`: Indicates if more batches remain
  - `success`: Translation process status

#### 2. Repository Initialization `/api/init-repository`

- **Purpose**: Create a new GitHub repository
- **Input**:
  - `repoName`: Chosen repository name
  - `mapConfig`: Current map configuration
- **Actions**:
  - Validate repository name
  - Create GitHub repository
  - Prepare initial project structure
- **Output**:
  - `repoUrl`: URL of the created GitHub repository

#### 3. Translation File Commitment `/api/commit-files`

- **Purpose**: Commit translation files to the repository
- **Input**:
  - `repoName`: Repository name
  - `translations`: Batch of language translations
  - `isLastBatch`: Flag for final batch
- **Processing Strategy**:
  - Batch processing (6 languages per batch)
  - Fallback to single file processing if batch fails
- **Features**:
  - Tracks translation progress
  - Handles partial success scenarios
  - Provides retry mechanism

#### 4. Storage Cleanup `/api/cleanup-storage`

- **Purpose**: Remove temporary files and manage storage
- **Input**: None
- **Actions**:
  - Clear temporary translation and configuration files
  - Report remaining storage blobs
- **Output**:
  - `remainingBlobs`: Number of files left in storage

#### 5. Vercel Deployment `/api/deploy-vercel`

- **Purpose**: Deploy the repository to Vercel
- **Input**:
  - `repoName`: Repository to deploy
- **Actions**:
  - Connect GitHub repository to Vercel
  - Configure project settings
  - Trigger deployment
- **Output**:
  - `projectUrl`: Deployed project URL
  - Generates embed code

### Comprehensive Workflow

1. **Translation Generation**

   - Collect all translatable content
   - Generate translations across 24 languages
   - Batch-process translations

2. **Repository Preparation**

   - Create GitHub repository
   - Validate project structure

3. **Translation File Management**

   - Commit translation files
   - Handle batch processing
   - Manage translation progress

4. **Storage Optimization**

   - Clean up temporary files
   - Manage storage resources

5. **Deployment**
   - Deploy to Vercel
   - Generate project URL
   - Create embed code

### Deployment Resilience

- Robust retry mechanism (up to 3 attempts)
- Detailed error tracking
- Partial success support for translations
- Graceful fallback strategies

### Error Handling Capabilities

- Retry mechanism for each API call
- Exponential backoff between retries
- Detailed error logging
- Ability to resume from last successful step

## Getting Started

### Local Development

1. Clone the repository:

   ```bash
   git clone https://your-repository-url.git
   cd your-project-directory
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   pnpm install
   ```

3. Run development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Data Input Format

The application requires a CSV with the following columns:

- `country`: Full country name
- `id`: Two-letter EU country code
- `value`: Numerical value (can be null)
- `extraInfo`: Boolean indicator

### Example CSV

```csv
country,id,value,extraInfo
Austria,AT,0.035,FALSE
Belgium,BE,0.083,FALSE
```

## Map Configuration Options

### Dataset Types

- **Values**: Numerical data visualization
- **Binary**: Binary (true/false) data representation

### Display Options

- Tooltips toggle
- Legend visibility
- Scale bar display
- Custom unit labels
- Override scale bar values

## Translation Feature

- Supports translation of all text elements
- Tracks translation progress
- Generates translations for 24 languages
- Provides detailed progress and error reporting

## Color Scheme Configuration

### Scheme Types

- **Sequential**: Single-hue color gradients
- **Diverging**: Contrasting color schemes

### Color Customization

- Choose from multiple predefined color schemes
- Reverse color order
- Select number of color classes (3-9)

### Deployment Considerations

#### GitHub Repository

- Automatically creates a new repository
- Supports repository names with letters, numbers, hyphens, and underscores

#### Vercel Deployment

- Automatic project setup
- Generates project URL
- Provides embed code for easy integration
- Seamless GitHub repository integration

## Troubleshooting

- Ensure CSV data matches required format
- Check browser console for any runtime errors
- Verify GitHub and Vercel account connections
- Review deployment step messages

## Error Handling

- Robust retry mechanism for API requests
- Detailed error messages
- Partial success tracking for translations

## Contact

Alsino Skowronnek: https://github.com/alsino/

## Additional Resources

- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Vercel Deployment Documentation](https://vercel.com/docs/concepts/deployments/overview)
