import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBranch, deleteBranch, setBranchStatus } from '../src/db/branches'
import { createCuisine, listCuisinesForBranch } from '../src/db/cuisines'
import { createEnquiry, getEnquiryById } from '../src/db/enquiries'
import {
  createPackage,
  deletePackage,
  getPackageById,
  getPublishedPackageBySlug,
  listPackages,
  listPublishedPackages,
  setPackageStatus,
  updatePackage,
  type PackageInput,
} from '../src/db/packages'

const db = env.DB

// Storage is shared within this file, so every test starts from the same fixtures.
let branchA: number
let branchB: number
let arab: number
let malay: number

const pkg = (over: Partial<PackageInput> = {}): PackageInput => ({
  slug: 'pkg',
  branch_id: branchA,
  cuisine_id: arab,
  name: 'Package',
  description: null,
  price_sen: 3500,
  min_pax: 50,
  inclusions: ['Main dish', 'Drinks'],
  is_popular: false,
  image_id: null,
  sort_order: 0,
  status: 'published',
  ...over,
})

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM enquiries'),
    db.prepare('DELETE FROM packages'),
    db.prepare('DELETE FROM branches'),
    db.prepare('DELETE FROM cuisines'),
  ])
  const branch = { name_bm: null, address: null, phone: null, image_id: null, status: 'published' as const }
  branchA = await createBranch(db, { ...branch, slug: 'a', name: 'Branch A', sort_order: 1 })
  branchB = await createBranch(db, { ...branch, slug: 'b', name: 'Branch B', sort_order: 2 })
  const cuisine = { name_bm: null, description: null, description_bm: null, image_id: null, status: 'published' as const }
  arab = await createCuisine(db, { ...cuisine, slug: 'arab', name: 'Arab', sort_order: 1 })
  malay = await createCuisine(db, { ...cuisine, slug: 'malay', name: 'Malay', sort_order: 2 })
})

describe('createPackage / getPackageById', () => {
  it('round-trips inclusions as an array and is_popular as a boolean', async () => {
    const id = await createPackage(db, pkg({ inclusions: ['Rice', 'Lamb'], is_popular: true }))
    const p = await getPackageById(db, id)
    expect(p).toMatchObject({ id, slug: 'pkg', price_sen: 3500, inclusions: ['Rice', 'Lamb'], is_popular: true })
  })

  it('returns null for a missing id', async () => {
    expect(await getPackageById(db, 999)).toBeNull()
  })

  it('rejects duplicate slugs, negative prices and zero min pax', async () => {
    await createPackage(db, pkg())
    await expect(createPackage(db, pkg())).rejects.toThrow(/UNIQUE/)
    await expect(createPackage(db, pkg({ slug: 'neg', price_sen: -1 }))).rejects.toThrow(/CHECK/)
    await expect(createPackage(db, pkg({ slug: 'zero', min_pax: 0 }))).rejects.toThrow(/CHECK/)
  })

  it('rejects a status outside published / draft / hidden', async () => {
    await expect(createPackage(db, pkg({ status: 'live' as never }))).rejects.toThrow(/CHECK/)
  })

  it('rejects an unknown branch', async () => {
    await expect(createPackage(db, pkg({ branch_id: 999 }))).rejects.toThrow(/FOREIGN KEY/)
  })
})

describe('listPublishedPackages', () => {
  beforeEach(async () => {
    await createPackage(db, pkg({ slug: 'a-arab', name: 'A Arab', price_sen: 4000 }))
    await createPackage(db, pkg({ slug: 'a-malay', name: 'A Malay', cuisine_id: malay, price_sen: 3000 }))
    await createPackage(db, pkg({ slug: 'a-popular', name: 'A Popular', price_sen: 5000, is_popular: true }))
    await createPackage(db, pkg({ slug: 'b-arab', name: 'B Arab', branch_id: branchB }))
    await createPackage(db, pkg({ slug: 'a-draft', name: 'A Draft', status: 'draft' }))
    await createPackage(db, pkg({ slug: 'a-hidden', name: 'A Hidden', status: 'hidden' }))
  })

  it('returns only published packages, popular first, then cheapest', async () => {
    const slugs = (await listPublishedPackages(db)).map((p) => p.slug)
    expect(slugs).toEqual(['a-popular', 'a-malay', 'b-arab', 'a-arab'])
  })

  it('filters by branch, cuisine, or both', async () => {
    const slugs = async (f: { branchId?: number; cuisineId?: number }) =>
      (await listPublishedPackages(db, f)).map((p) => p.slug).sort()

    expect(await slugs({ branchId: branchB })).toEqual(['b-arab'])
    expect(await slugs({ cuisineId: malay })).toEqual(['a-malay'])
    expect(await slugs({ branchId: branchA, cuisineId: arab })).toEqual(['a-arab', 'a-popular'])
  })

  it('includes branch and cuisine names for the card chips', async () => {
    const [p] = await listPublishedPackages(db, { branchId: branchB })
    expect(p).toMatchObject({ branch_name: 'Branch B', branch_slug: 'b', cuisine_name: 'Arab', cuisine_slug: 'arab' })
    expect(p.inclusions).toEqual(['Main dish', 'Drinks'])
  })

  it('hides packages whose branch is not published', async () => {
    await setBranchStatus(db, branchB, 'hidden')
    expect((await listPublishedPackages(db)).map((p) => p.slug)).not.toContain('b-arab')
  })

  it('treats SQL in filters as plain values', async () => {
    expect(await listPublishedPackages(db, { branchId: '1 OR 1=1' as never })).toEqual([])
  })
})

describe('getPublishedPackageBySlug', () => {
  it('returns published packages and null for drafts or unknown slugs', async () => {
    await createPackage(db, pkg({ slug: 'live' }))
    await createPackage(db, pkg({ slug: 'draft', status: 'draft' }))

    expect((await getPublishedPackageBySlug(db, 'live'))?.branch_name).toBe('Branch A')
    expect(await getPublishedPackageBySlug(db, 'draft')).toBeNull()
    expect(await getPublishedPackageBySlug(db, 'nope')).toBeNull()
  })
})

describe('admin writes', () => {
  it('listPackages returns every status', async () => {
    await createPackage(db, pkg({ slug: 'p1' }))
    await createPackage(db, pkg({ slug: 'p2', status: 'draft' }))
    await createPackage(db, pkg({ slug: 'p3', status: 'hidden' }))
    expect((await listPackages(db)).map((p) => p.status).sort()).toEqual(['draft', 'hidden', 'published'])
  })

  it('updatePackage replaces fields and bumps updated_at', async () => {
    const id = await createPackage(db, pkg())
    await db.prepare("UPDATE packages SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?").bind(id).run()

    expect(await updatePackage(db, id, pkg({ name: 'Renamed', price_sen: 4200, inclusions: ['Only'] }))).toBe(true)
    const p = await getPackageById(db, id)
    expect(p).toMatchObject({ name: 'Renamed', price_sen: 4200, inclusions: ['Only'] })
    expect(p!.updated_at > '2000-01-01T00:00:00Z').toBe(true)
  })

  it('returns false when the package does not exist', async () => {
    expect(await updatePackage(db, 999, pkg())).toBe(false)
    expect(await setPackageStatus(db, 999, 'hidden')).toBe(false)
    expect(await deletePackage(db, 999)).toBe(false)
  })

  it('setPackageStatus takes a package off the public list', async () => {
    const id = await createPackage(db, pkg())
    await setPackageStatus(db, id, 'hidden')
    expect(await listPublishedPackages(db)).toEqual([])
  })

  it('deletePackage keeps enquiries that referenced it', async () => {
    const id = await createPackage(db, pkg())
    const enquiryId = await createEnquiry(db, {
      name: 'Aisha', phone: '+60 12-000 0000', email: null, event_date: '2026-12-01', pax: 80,
      branch_id: branchA, cuisine_id: arab, package_id: id, message: null,
    })

    expect(await deletePackage(db, id)).toBe(true)
    expect((await getEnquiryById(db, enquiryId))?.package_id).toBeNull()
  })

  it('a branch with packages cannot be deleted', async () => {
    await createPackage(db, pkg())
    await expect(deleteBranch(db, branchA)).rejects.toThrow(/FOREIGN KEY/)
  })
})

describe('listCuisinesForBranch', () => {
  it('lists only cuisines with a published package at that branch', async () => {
    await createPackage(db, pkg({ slug: 'p1', cuisine_id: arab }))
    await createPackage(db, pkg({ slug: 'p2', cuisine_id: malay, status: 'draft' }))
    expect((await listCuisinesForBranch(db, branchA)).map((c) => c.slug)).toEqual(['arab'])
    expect(await listCuisinesForBranch(db, branchB)).toEqual([])
  })
})
