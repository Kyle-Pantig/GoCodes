import { NextResponse } from 'next/server'
import { retryDbOperation } from '@/lib/db-utils'

// Cache countries data in memory for 24 hours
let cachedCountries: Array<{ name: string; alpha2Code: string; alpha3Code: string; capital?: string; region?: string; callingCodes: string[] }> | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

async function fetchCountriesFromAPI(): Promise<Array<{ name: string; alpha2Code: string; alpha3Code: string; capital?: string; region?: string; callingCodes: string[] }>> {
  const apiUrl = process.env.COUNTRIES_API_URL || 'https://www.apicountries.com/countries'
  
  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch countries: ${response.status} ${response.statusText}`)
  }
  
  const countries = await response.json() as Array<{
    name: string
    alpha2Code: string
    alpha3Code: string
    capital?: string
    region?: string
    callingCodes: string[]
  }>
  
  // Extract only the fields we need and sort alphabetically
  return countries
    .map((country) => ({
      name: country.name,
      alpha2Code: country.alpha2Code,
      alpha3Code: country.alpha3Code,
      capital: country.capital,
      region: country.region,
      callingCodes: country.callingCodes || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function GET() {
  try {
    // Check cache first
    const now = Date.now()
    if (cachedCountries && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({ countries: cachedCountries })
    }

    // Fetch from API with retry logic
    const countries = await retryDbOperation(() => fetchCountriesFromAPI(), 3, 1000)
    
    // Update cache
    cachedCountries = countries
    cacheTimestamp = now

    return NextResponse.json({ countries })
  } catch (error) {
    console.error('Error fetching countries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch countries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

