const BASE_URL = 'https://job-analyzer.rcormier.workers.dev';

async function backfill() {
  try {
    console.log('Starting backfill...');
    const response = await fetch(`${BASE_URL}/api/backfill-resume-tracking`, {
      method: 'POST',
    });
    const data = await response.json();
    console.log('Backfill result:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Backfill error:', error.message);
  }
}

async function aggregate() {
  try {
    console.log('\nStarting aggregation...');
    const response = await fetch(`${BASE_URL}/api/manually-aggregate-analytics`, {
      method: 'POST',
    });
    const data = await response.json();
    console.log('Aggregation result:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Aggregation error:', error.message);
  }
}

async function main() {
  await backfill();
  await new Promise(r => setTimeout(r, 2000));
  await aggregate();
}

main();
