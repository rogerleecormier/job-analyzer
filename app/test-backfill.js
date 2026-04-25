// Test backfill script
import fetch from 'node-fetch';

const BASE_URL = 'https://job-analyzer.rcormier.workers.dev';

async function backfill() {
  try {
    console.log('Starting backfill...');
    const response = await fetch(`${BASE_URL}/api/backfill-resume-tracking`, {
      method: 'POST',
    });
    const data = await response.json();
    console.log('Backfill result:', data);
    return data;
  } catch (error) {
    console.error('Backfill error:', error);
  }
}

async function aggregate() {
  try {
    console.log('Starting aggregation...');
    const response = await fetch(`${BASE_URL}/api/manually-aggregate-analytics`, {
      method: 'POST',
    });
    const data = await response.json();
    console.log('Aggregation result:', data);
    return data;
  } catch (error) {
    console.error('Aggregation error:', error);
  }
}

async function main() {
  await backfill();
  await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
  await aggregate();
}

main();
