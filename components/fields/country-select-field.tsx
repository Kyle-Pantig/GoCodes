'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

type Country = {
  name: string
  alpha2Code: string
  alpha3Code: string
  capital?: string
  region?: string
  callingCodes: string[]
}

async function fetchCountries(): Promise<Country[]> {
  // Use our API route to avoid CORS issues
  const response = await fetch('/api/countries')
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch countries')
  }
  const data = await response.json()
  return data.countries || []
}

interface CountrySelectFieldProps {
  value?: string
  onValueChange?: (value: string, country?: Country) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
}

export function CountrySelectField({
  value,
  onValueChange,
  placeholder = 'Select country...',
  disabled = false,
  error = false,
}: CountrySelectFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  const { data: countriesData, isLoading, error: queryError } = useQuery({
    queryKey: ['countries'],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    retry: 2,
  })

  const countries = React.useMemo(() => {
    if (queryError) {
      console.error('Error fetching countries:', queryError)
      return []
    }
    // Handle both array and object response formats
    if (Array.isArray(countriesData)) {
      return countriesData
    }
    if (countriesData && typeof countriesData === 'object') {
      const data = countriesData as { countries?: Country[] }
      if ('countries' in data && Array.isArray(data.countries)) {
        return data.countries
      }
    }
    return []
  }, [countriesData, queryError])

  const selected = countries.find((country: Country) => country.name === value)

  const filteredCountries = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return countries
    }
    const query = searchQuery.toLowerCase()
    return countries.filter((country: Country) =>
      country.name.toLowerCase().includes(query) ||
      country.alpha2Code.toLowerCase().includes(query) ||
      country.alpha3Code.toLowerCase().includes(query) ||
      country.capital?.toLowerCase().includes(query)
    )
  }, [countries, searchQuery])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-card!",
            error && "border-destructive"
          )}
          disabled={disabled || isLoading}
          aria-invalid={error ? 'true' : 'false'}
        >
          {selected ? (
            <span className="truncate">{selected.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search countries..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-none">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner className="h-4 w-4" />
              </div>
            ) : queryError ? (
              <div className="flex flex-col items-center justify-center py-4 text-sm text-destructive">
                <p>Failed to load countries</p>
                <p className="text-xs text-muted-foreground mt-1">Please try again</p>
              </div>
            ) : filteredCountries.length === 0 ? (
              <CommandEmpty>
                {countries.length > 0 ? 'No countries match your search.' : 'No countries found.'}
              </CommandEmpty>
            ) : (
              <ScrollArea className="h-[300px]">
                <CommandGroup>
                  {filteredCountries.map((country: Country) => {
                    const isSelected = value === country.name

                    return (
                      <CommandItem
                        key={country.alpha2Code}
                        value={country.name}
                        onSelect={() => {
                          onValueChange?.(country.name, country)
                          setOpen(false)
                          setSearchQuery('')
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex-1">{country.name}</span>
                        {country.callingCodes && country.callingCodes.length > 0 && (
                          <span className="text-muted-foreground text-xs ml-2">
                            +{country.callingCodes[0]}
                          </span>
                        )}
                        {country.capital && (
                          <span className="text-muted-foreground text-xs ml-2">
                            {country.capital}
                          </span>
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </ScrollArea>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

