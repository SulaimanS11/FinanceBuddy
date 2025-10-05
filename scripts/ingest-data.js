#!/usr/bin/env node

/**
 * CLI script for running the data ingestion pipeline
 * Usage: node scripts/ingest-data.js [options]
 */

const { DataIngestionPipeline } = require('../dist/services/DataIngestionPipeline');
const { EmbeddingService } = require('../dist/services/EmbeddingService');
const { VectorStore } = require('../dist/services/VectorStore');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'create-sample':
      await createSampleData();
      break;
    case 'ingest':
      await ingestData();
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

async function createSampleData() {
  console.log('🚀 Creating sample data structure...');
  
  try {
    // Create a minimal pipeline just for sample data creation
    const embeddingService = new EmbeddingService({
      apiKey: 'dummy-key'
    });
    
    const vectorStore = new VectorStore({
      embeddingService
    });
    
    const pipeline = new DataIngestionPipeline(embeddingService, vectorStore);
    
    await pipeline.createSampleDataStructure('./data');
    console.log('✅ Sample data structure created successfully!');
    console.log('📁 Check the ./data directory for sample files');
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error.message);
    process.exit(1);
  }
}

async function ingestData() {
  console.log('🚀 Starting data ingestion...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    console.log('Set it with: export GEMINI_API_KEY=your-api-key');
    process.exit(1);
  }
  
  try {
    // Initialize services
    const embeddingService = new EmbeddingService({
      apiKey,
      model: 'text-embedding-004',
      batchSize: 10
    });

    const vectorStore = new VectorStore({
      chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
      collectionName: 'securities_documents',
      embeddingService
    });

    // Initialize vector store
    console.log('🔌 Initializing vector store...');
    await vectorStore.initialize();

    // Create data ingestion pipeline
    const pipeline = new DataIngestionPipeline(embeddingService, vectorStore, {
      inputDirectory: './data',
      chunkSize: 800,
      chunkOverlap: 150,
      batchSize: 5,
      validateBeforeProcessing: true
    });

    // Ingest documents
    console.log('📚 Processing documents...');
    const result = await pipeline.ingestFromDirectory();

    // Display results
    console.log('\n📊 Ingestion Results:');
    console.log(`✅ Files processed: ${result.inputFiles.length}`);
    console.log(`📄 Documents created: ${result.processedDocuments.length}`);
    console.log(`✅ Successful: ${result.stats.successfulDocuments}`);
    console.log(`❌ Failed: ${result.stats.failedDocuments}`);
    console.log(`⏱️  Processing time: ${result.stats.processingTimeMs}ms`);

    if (result.skippedFiles.length > 0) {
      console.log(`\n⚠️  Skipped files: ${result.skippedFiles.length}`);
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error.severity.toUpperCase()}: ${error.error}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Test search functionality
    if (result.processedDocuments.length > 0) {
      console.log('\n🔍 Testing search functionality...');
      const searchResults = await vectorStore.searchSimilar('securities', { limit: 3 });
      console.log(`Found ${searchResults.length} similar documents`);
    }

    console.log('\n✅ Data ingestion completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during ingestion:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
📚 Securities RAG Tutor - Data Ingestion CLI

Usage: node scripts/ingest-data.js <command>

Commands:
  create-sample    Create sample data structure in ./data directory
  ingest          Ingest documents from ./data directory into vector store
  help            Show this help message

Environment Variables:
  GEMINI_API_KEY   Required for ingestion - your Google Gemini API key
  CHROMA_URL       Optional - Chroma vector database URL (default: http://localhost:8000)

Examples:
  # Create sample data
  node scripts/ingest-data.js create-sample
  
  # Ingest data (requires API key and running Chroma instance)
  export GEMINI_API_KEY=your-api-key
  node scripts/ingest-data.js ingest
`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, createSampleData, ingestData };