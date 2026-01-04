'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Importar traducciones
import es from '@/locales/es.json'
import en from '@/locales/en.json'
import pt from '@/locales/pt.json'

// Tipos
export type Locale = 'es' | 'en' | 'pt'

type TranslationValue = string | { [key: string]: TranslationValue }
type Translations = { [key: string]: TranslationValue }

const translations: Record<Locale, Translations> = { es, en, pt }

// Lista de zonas horarias comunes
export const TIMEZONES = [
  { value: 'America/Guayaquil', label: 'Ecuador (UTC-5)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/Lima', label: 'Perú (UTC-5)' },
  { value: 'America/Santiago', label: 'Chile (UTC-3/-4)' },
  { value: 'America/Buenos_Aires', label: 'Argentina (UTC-3)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (UTC-3)' },
  { value: 'America/Mexico_City', label: 'México (UTC-6)' },
  { value: 'America/New_York', label: 'EEUU Este (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'EEUU Oeste (UTC-8/-7)' },
  { value: 'Europe/Madrid', label: 'España (UTC+1/+2)' },
  { value: 'Europe/London', label: 'Reino Unido (UTC+0/+1)' },
  { value: 'UTC', label: 'UTC' },
]

export const LANGUAGES = [
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'pt', label: 'Português', flag: '🇧🇷' },
]

// Contexto
interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  timezone: string
  setTimezone: (tz: string) => void
  t: (key: string, params?: Record<string, string | number>) => string
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string
  formatTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (date: Date | string) => string
  toLocalTime: (utcDate: Date | string) => Date
  toUTC: (localDate: Date | string) => Date
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

// Provider
interface I18nProviderProps {
  children: ReactNode
  defaultLocale?: Locale
  defaultTimezone?: string
}

export function I18nProvider({
  children,
  defaultLocale = 'es',
  defaultTimezone = 'America/Guayaquil'
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [timezone, setTimezoneState] = useState<string>(defaultTimezone)

  // Cargar preferencias guardadas
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('nf_locale') as Locale
      const savedTimezone = localStorage.getItem('nf_timezone')
      if (savedLocale && translations[savedLocale]) {
        setLocaleState(savedLocale)
      }
      if (savedTimezone) {
        setTimezoneState(savedTimezone)
      }
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    if (typeof window !== 'undefined') {
      localStorage.setItem('nf_locale', newLocale)
    }
  }

  const setTimezone = (tz: string) => {
    setTimezoneState(tz)
    if (typeof window !== 'undefined') {
      localStorage.setItem('nf_timezone', tz)
    }
  }

  // Función de traducción
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: TranslationValue = translations[locale]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Fallback a español si no existe
        let fallback: TranslationValue = translations['es']
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk]
          } else {
            return key // Retornar key si no existe en ningún idioma
          }
        }
        value = fallback
        break
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // Reemplazar parámetros {{param}}
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
        return params[paramKey]?.toString() || `{{${paramKey}}}`
      })
    }

    return value
  }

  // Convertir fecha UTC a hora local del cliente
  const toLocalTime = (utcDate: Date | string): Date => {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
    // Crear una fecha en la zona horaria del cliente
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
    const localString = date.toLocaleString('sv-SE', options) // sv-SE da formato YYYY-MM-DD HH:mm:ss
    return new Date(localString.replace(' ', 'T'))
  }

  // Convertir hora local a UTC
  const toUTC = (localDate: Date | string): Date => {
    const date = typeof localDate === 'string' ? new Date(localDate) : localDate
    // Obtener el offset de la zona horaria
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    })
    const parts = formatter.formatToParts(date)
    const offsetPart = parts.find(p => p.type === 'timeZoneName')

    // Parsear offset (ej: "GMT-5" -> -5)
    if (offsetPart) {
      const match = offsetPart.value.match(/GMT([+-]?\d+)?/)
      if (match) {
        const offsetHours = parseInt(match[1] || '0', 10)
        const utcDate = new Date(date.getTime() - (offsetHours * 60 * 60 * 1000))
        return utcDate
      }
    }
    return date
  }

  // Formatear fecha
  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    }
    return d.toLocaleDateString(locale, defaultOptions)
  }

  // Formatear hora
  const formatTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    }
    return d.toLocaleTimeString(locale, defaultOptions)
  }

  // Formatear fecha y hora completa
  const formatDateTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const value: I18nContextType = {
    locale,
    setLocale,
    timezone,
    setTimezone,
    t,
    formatDate,
    formatTime,
    formatDateTime,
    toLocalTime,
    toUTC
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

// Hook
export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}

// Hook para obtener solo traducciones (sin timezone)
export function useT() {
  const { t } = useTranslation()
  return t
}

// Utilidad para convertir hora a zona horaria específica (para el servidor)
export function convertToTimezone(date: Date | string, fromTz: string, toTz: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date

  // Obtener el string en la zona horaria de origen
  const sourceString = d.toLocaleString('en-US', { timeZone: fromTz })
  const sourceDate = new Date(sourceString)

  // Obtener el string en la zona horaria de destino
  const targetString = d.toLocaleString('en-US', { timeZone: toTz })
  const targetDate = new Date(targetString)

  // Calcular la diferencia
  const diff = targetDate.getTime() - sourceDate.getTime()

  return new Date(d.getTime() + diff)
}

// Utilidad para obtener offset de una zona horaria en minutos
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  return (tzDate.getTime() - utcDate.getTime()) / (60 * 1000)
}
