import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createReadStream } from 'fs'
import { writeFile, unlink } from 'fs/promises'
import * as path from 'path'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!
const googleAIKey = process.env.GOOGLE_AI_API_KEY!

if (!supabaseUrl || !supabaseServiceKey || !googleAIKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SECRET_KEY') 
  console.error('- GOOGLE_AI_API_KEY')
  process.exit(1)
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const genAI = new GoogleGenerativeAI(googleAIKey)

interface Plant {
  id: string
  name: string
  latin_name: string
}

function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o') 
    .replace(/ä/g, 'a')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '') // Remove any other non-alphanumeric characters except hyphens
}

async function ensureStorageBucket() {
  console.log('🪣 Checking storage bucket...')
  
  // Try to create the bucket (will fail if it already exists, which is fine)
  const { error: createError } = await supabase.storage.createBucket('illustrations', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    fileSizeLimit: 5242880 // 5MB
  })

  if (createError && !createError.message.includes('already exists')) {
    throw new Error(`Failed to create storage bucket: ${createError.message}`)
  }

  console.log('✅ Storage bucket ready')
}

async function generateKawaiiImage(plantName: string): Promise<Buffer> {
  console.log(`🎨 Generating kawaii image for ${plantName}...`)
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    const prompt = `kawaii botanical illustration of ${plantName}, cute kawaii style, soft pastel colors, simple white background, no text, no labels, watercolor feel`
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/png',
          data: ''
        }
      },
      { text: prompt }
    ])

    // Note: Google's Gemini API doesn't actually generate images yet
    // This is a placeholder for when the feature becomes available
    // For now, we'll create a simple placeholder
    const placeholderImage = Buffer.from('placeholder-image-data')
    return placeholderImage
    
  } catch (error) {
    console.error(`Error generating image for ${plantName}:`, error)
    throw error
  }
}

async function uploadImageToSupabase(plantId: string, plantName: string, imageBuffer: Buffer): Promise<string> {
  console.log(`📤 Uploading image for ${plantName}...`)
  
  const sanitizedName = sanitizeFilename(plantName)
  const fileName = `${plantId}-${sanitizedName}.png`
  const filePath = `kawaii/${fileName}`
  
  const { data, error } = await supabase.storage
    .from('illustrations')
    .upload(filePath, imageBuffer, {
      contentType: 'image/png',
      upsert: true
    })

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('illustrations')
    .getPublicUrl(filePath)

  console.log(`✅ Uploaded: ${publicUrl}`)
  return publicUrl
}

async function updatePlantImageUrl(plantId: string, imageUrl: string, plantName: string): Promise<void> {
  console.log(`📝 Updating database for ${plantName}...`)
  
  const { error } = await supabase
    .from('plants')
    .update({ illustration_url: imageUrl })
    .eq('id', plantId)

  if (error) {
    throw new Error(`Failed to update plant ${plantName}: ${error.message}`)
  }

  console.log(`✅ Updated ${plantName} in database`)
}

async function generatePlaceholderImage(plantName: string): Promise<Buffer> {
  // Since Google's image generation isn't available yet, create a simple SVG placeholder
  const svg = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="300" height="300" fill="#f8f9fa"/>
    <circle cx="150" cy="120" r="40" fill="#4A7C59" opacity="0.3"/>
    <rect x="140" y="160" width="20" height="80" fill="#4A7C59" opacity="0.5"/>
    <text x="150" y="250" text-anchor="middle" font-family="Arial" font-size="16" fill="#2C2C2A">${plantName}</text>
    <text x="150" y="270" text-anchor="middle" font-family="Arial" font-size="12" fill="#888780">Kawaii Style</text>
  </svg>`
  
  return Buffer.from(svg)
}

async function main() {
  try {
    // Check if specific plants were requested via command line args
    const requestedPlants = process.argv.slice(2)
    
    if (requestedPlants.length > 0) {
      console.log(`🌱 Regenerating images for specific plants: ${requestedPlants.join(', ')}\n`)
    } else {
      console.log('🌱 Starting kawaii image generation for all plants...\n')
    }
    
    // Ensure storage bucket exists
    await ensureStorageBucket()
    
    // Get plants (all or specific ones)
    console.log('📚 Fetching plants from database...')
    let query = supabase
      .from('plants')
      .select('id, name, latin_name')
    
    if (requestedPlants.length > 0) {
      query = query.in('name', requestedPlants)
    } else {
      query = query.order('name')
    }

    const { data: plants, error } = await query

    if (error) {
      throw new Error(`Failed to fetch plants: ${error.message}`)
    }

    if (!plants || plants.length === 0) {
      if (requestedPlants.length > 0) {
        console.log(`❌ No plants found with names: ${requestedPlants.join(', ')}`)
      } else {
        console.log('❌ No plants found in database')
      }
      return
    }

    console.log(`✅ Found ${plants.length} plant(s)\n`)

    // Process each plant
    for (const plant of plants) {
      try {
        console.log(`\n🌿 Processing: ${plant.name} (${plant.latin_name})`)
        
        // Generate kawaii image (placeholder for now)
        const imageBuffer = await generatePlaceholderImage(plant.name)
        
        // Upload to Supabase Storage
        const imageUrl = await uploadImageToSupabase(plant.id, plant.name, imageBuffer)
        
        // Update database
        await updatePlantImageUrl(plant.id, imageUrl, plant.name)
        
        console.log(`🎉 Completed: ${plant.name}`)
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`❌ Failed to process ${plant.name}:`, error)
        continue // Continue with next plant
      }
    }
    
    console.log('\n🎉 All done! Kawaii images generated and uploaded.')
    console.log('\n💡 Note: Currently using placeholder images. Once Google\'s image generation API is available,')
    console.log('   replace the generatePlaceholderImage function with actual AI generation.')
    
  } catch (error) {
    console.error('💥 Script failed:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}

export default main