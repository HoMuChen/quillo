declare module '@tryghost/admin-api' {
  export interface GhostAdminAPIOptions {
    url: string
    key: string
    version: string
  }

  export interface GhostPost {
    id: string
    uuid?: string
    title?: string
    slug?: string
    html?: string
    url?: string | null
    status?: 'draft' | 'published' | 'scheduled'
    published_at?: string | null
    meta_title?: string | null
    meta_description?: string | null
    canonical_url?: string | null
    feature_image?: string | null
    tags?: Array<string | { id?: string; name?: string; slug?: string }>
    excerpt?: string | null
    updated_at?: string
    [k: string]: unknown
  }

  export interface GhostImage {
    url: string
    ref?: string | null
  }

  export default class GhostAdminAPI {
    constructor(options: GhostAdminAPIOptions)
    site: { read(): Promise<{ title?: string; url?: string }> }
    posts: {
      browse(options?: Record<string, unknown>): Promise<GhostPost[]>
      read(params: { id: string } | { slug: string }, options?: Record<string, unknown>): Promise<GhostPost>
      add(input: Partial<GhostPost>, options?: Record<string, unknown>): Promise<GhostPost>
      edit(input: Partial<GhostPost> & { id: string }, options?: Record<string, unknown>): Promise<GhostPost>
      delete(params: { id: string }): Promise<void>
    }
    images: {
      upload(input: { file: Buffer | Blob | string; purpose?: 'image' | 'profile_image' | 'icon'; ref?: string }): Promise<GhostImage>
    }
  }
}
