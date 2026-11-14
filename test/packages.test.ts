import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import app from '../src/index'
import { createBranch, deleteBranch, listHallBranches, type BranchInput } from '../src/db/branches'
import { createCuisine, listCuisinesForService, setCuisineStatus } from '../src/db/cuisines'
import { createEnquiry, getEnquiryById, type EnquiryInput } from '../src/db/enquiries'
import { createMenuItem, setMenuItemStatus } from '../src/db/menu_items'
import { createGroup, deleteGroup, listGroups, updateGroup } from '../src/db/package_groups'
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
import { checkMenuChoices } from '../src/lib/validation'

const db = env.DB

// Storage is shared within this file, so every test starts from the same fixtures.
let arab: number
let malay: number

const pkg = (over: Partial<PackageInput> = {}): PackageInput => ({
  slug: 'pkg',
  cuisine_id: arab,
  service_type: 'both',
  name: 'Package',
  name_bm: null,
  pdf_key: null,
  price_sen: 3500,
  min_pax: 50,
  max_pax: null,
  inclusions: ['Main dish', 'Drinks'],
  inclusions_bm: [],
  is_popular: false,
  image_id: null,
  sort_order: 0,
  status: 'published',
  ...over,
})

const branchInput = (over: Partial<BranchInput> = {}): BranchInput => ({
  slug: 'a', name: 'Branch A', name_bm: null, address: null, phone: null, maps_link: null,
  has_hall: true, hall_capacity: 200, image_id: null, sort_order: 0, status: 'published', ...over,
})

const enquiry = (over: Partial<EnquiryInput> = {}): EnquiryInput => ({
  name: 'Aisha', phone: '+60 12-000 0000', email: null, service_type: 'in_house', event_date: '2026-12-01', event_time: '12:00',
  pax: 80, branch_id: null, cuisine_id: arab, package_id: null, menu_choices: null, address_line: null, postcode: null,
  city: null, state: null, setup_notes: null, message: null, estimate_sen: 280000, ...over,
})

const dish = (name: string, cuisine_id = arab) =>
  createMenuItem(db, { cuisine_id, name, name_bm: null, pdf_key: null, category: null, price_sen: null, is_bestseller: false, image_id: null, sort_order: 0, status: 'published' })

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM enquiries'),
    db.prepare('DELETE FROM package_groups'),
    db.prepare('DELETE FROM packages'),
    db.prepare('DELETE FROM menu_items'),
    db.prepare('DELETE FROM branches'),
    db.prepare('DELETE FROM cuisines'),
  ])
  const cuisine = { name_bm: null, description: null, description_bm: null, image_id: null, status: 'published' as const }
  arab = await createCuisine(db, { ...cuisine, slug: 'arab', name: 'Arab', sort_order: 1 })
  malay = await createCuisine(db, { ...cuisine, slug: 'malay', name: 'Malay', sort_order: 2 })
})

describe('createPackage / getPackageById', () => {
  it('round-trips inclusions, is_popular, service type and max pax', async () => {
    const id = await createPackage(db, pkg({ inclusions: ['Rice', 'Lamb'], is_popular: true, service_type: 'outside', max_pax: 300 }))
    const p = await getPackageById(db, id)
    expect(p).toMatchObject({ id, slug: 'pkg', price_sen: 3500, inclusions: ['Rice', 'Lamb'], is_popular: true, service_type: 'outside', max_pax: 300 })
  })

  it('returns null for a missing id', async () => {
    expect(await getPackageById(db, 999)).toBeNull()
  })

  it('rejects duplicate slugs, negative prices, zero min pax and max below min', async () => {
    await createPackage(db, pkg())
    await expect(createPackage(db, pkg())).rejects.toThrow(/UNIQUE/)
    await expect(createPackage(db, pkg({ slug: 'neg', price_sen: -1 }))).rejects.toThrow(/CHECK/)
    await expect(createPackage(db, pkg({ slug: 'zero', min_pax: 0 }))).rejects.toThrow(/CHECK/)
    await expect(createPackage(db, pkg({ slug: 'max', min_pax: 50, max_pax: 10 }))).rejects.toThrow(/CHECK/)
  })

  it('rejects unknown status or service type', async () => {
    await expect(createPackage(db, pkg({ status: 'live' as never }))).rejects.toThrow(/CHECK/)
    await expect(createPackage(db, pkg({ service_type: 'delivery' as never }))).rejects.toThrow(/CHECK/)
  })
})

describe('listPublishedPackages', () => {
  beforeEach(async () => {
    await createPackage(db, pkg({ slug: 'both', name: 'Both', price_sen: 4000 }))
    await createPackage(db, pkg({ slug: 'malay', name: 'Malay', cuisine_id: malay, price_sen: 3000 }))
    await createPackage(db, pkg({ slug: 'popular', name: 'Popular', price_sen: 5000, is_popular: true }))
    await createPackage(db, pkg({ slug: 'hall', name: 'Hall', service_type: 'in_house' }))
    await createPackage(db, pkg({ slug: 'out', name: 'Out', service_type: 'outside' }))
    await createPackage(db, pkg({ slug: 'draft', name: 'Draft', status: 'draft' }))
  })

  it('returns only published packages, popular first, then cheapest', async () => {
    const slugs = (await listPublishedPackages(db)).map((p) => p.slug)
    expect(slugs).toEqual(['popular', 'malay', 'hall', 'out', 'both'])
  })

  it('a service type also matches packages offered both ways', async () => {
    const slugs = async (f: Parameters<typeof listPublishedPackages>[1]) => (await listPublishedPackages(db, f)).map((p) => p.slug).sort()
    expect(await slugs({ serviceType: 'in_house', cuisineId: arab })).toEqual(['both', 'hall', 'popular'])
    expect(await slugs({ serviceType: 'outside', cuisineId: arab })).toEqual(['both', 'out', 'popular'])
    expect(await slugs({ cuisineId: malay })).toEqual(['malay'])
  })

  it('includes cuisine names for the card chips', async () => {
    const [p] = await listPublishedPackages(db, { cuisineId: malay })
    expect(p).toMatchObject({ cuisine_name: 'Malay', cuisine_slug: 'malay' })
  })

  it('hides packages whose cuisine is not published', async () => {
    await setCuisineStatus(db, malay, 'hidden')
    expect((await listPublishedPackages(db)).map((p) => p.slug)).not.toContain('malay')
  })

  it('treats SQL in filters as plain values', async () => {
    // Only the packages offered both ways match; the injected text matches nothing on its own.
    const found = await listPublishedPackages(db, { serviceType: "in_house' OR 1=1 --" as never })
    expect(found.map((p) => p.service_type)).toEqual(['both', 'both', 'both'])
  })
})

describe('getPublishedPackageBySlug', () => {
  it('returns published packages and null for drafts or unknown slugs', async () => {
    await createPackage(db, pkg({ slug: 'live' }))
    await createPackage(db, pkg({ slug: 'draft', status: 'draft' }))
    expect((await getPublishedPackageBySlug(db, 'live'))?.cuisine_name).toBe('Arab')
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
    expect(await updatePackage(db, id, pkg({ name: 'Renamed', price_sen: 4200, inclusions: ['Only'], service_type: 'in_house' }))).toBe(true)
    const p = await getPackageById(db, id)
    expect(p).toMatchObject({ name: 'Renamed', price_sen: 4200, inclusions: ['Only'], service_type: 'in_house' })
    expect(p!.updated_at > '2000-01-01T00:00:00Z').toBe(true)
  })

  it('returns false when the package does not exist', async () => {
    expect(await updatePackage(db, 999, pkg())).toBe(false)
    expect(await setPackageStatus(db, 999, 'hidden')).toBe(false)
    expect(await deletePackage(db, 999)).toBe(false)
  })

  it('deletePackage keeps enquiries that referenced it', async () => {
    const id = await createPackage(db, pkg())
    const enquiryId = await createEnquiry(db, enquiry({ package_id: id }))
    expect(await deletePackage(db, id)).toBe(true)
    expect((await getEnquiryById(db, enquiryId))?.package_id).toBeNull()
  })

  it('a branch can be deleted; its enquiries keep their row', async () => {
    const branchId = await createBranch(db, branchInput())
    const enquiryId = await createEnquiry(db, enquiry({ branch_id: branchId }))
    expect(await deleteBranch(db, branchId)).toBe(true)
    expect((await getEnquiryById(db, enquiryId))?.branch_id).toBeNull()
  })
})

describe('listCuisinesForService', () => {
  it('lists cuisines with a published package for that service type', async () => {
    await createPackage(db, pkg({ slug: 'p1', cuisine_id: arab, service_type: 'in_house' }))
    await createPackage(db, pkg({ slug: 'p2', cuisine_id: malay, service_type: 'both' }))
    await createPackage(db, pkg({ slug: 'p3', cuisine_id: arab, service_type: 'outside', status: 'draft' }))
    expect((await listCuisinesForService(db, 'in_house')).map((c) => c.slug)).toEqual(['arab', 'malay'])
    expect((await listCuisinesForService(db, 'outside')).map((c) => c.slug)).toEqual(['malay'])
  })
})

describe('listHallBranches', () => {
  it('lists published branches that have a hall', async () => {
    await createBranch(db, branchInput({ slug: 'hall', name: 'Hall' }))
    await createBranch(db, branchInput({ slug: 'none', name: 'No hall', has_hall: false }))
    await createBranch(db, branchInput({ slug: 'draft', name: 'Draft', status: 'draft' }))
    expect(await listHallBranches(db)).toEqual([expect.objectContaining({ slug: 'hall', has_hall: true, hall_capacity: 200 })])
  })
})

describe('package groups', () => {
  it('stores groups with their items, in order, and replaces items on update', async () => {
    const id = await createPackage(db, pkg())
    const [a, b, c] = [await dish('Lamb'), await dish('Chicken'), await dish('Fish')]
    const g = await createGroup(db, { package_id: id, name: 'Mains', name_bm: null, choose_count: 1, sort_order: 0 }, [a, b, b])
    const [group] = await listGroups(db, id)
    expect(group).toMatchObject({ id: g, choose_count: 1 })
    expect(group!.items.map((i) => i.id).sort()).toEqual([a, b].sort())

    await updateGroup(db, g, { name: 'Mains', name_bm: null, choose_count: 2, sort_order: 0 }, [b, c])
    expect((await listGroups(db, id))[0]!.items.map((i) => i.id).sort()).toEqual([b, c].sort())
  })

  it('leaves unpublished dishes out of the public list', async () => {
    const id = await createPackage(db, pkg())
    const [a, b] = [await dish('Lamb'), await dish('Chicken')]
    await createGroup(db, { package_id: id, name: 'Mains', name_bm: null, choose_count: 1, sort_order: 0 }, [a, b])
    await setMenuItemStatus(db, b, 'hidden')
    expect((await listGroups(db, id, { publishedOnly: true }))[0]!.items.map((i) => i.id)).toEqual([a])
  })

  it('is deleted with its package', async () => {
    const id = await createPackage(db, pkg())
    const g = await createGroup(db, { package_id: id, name: 'Mains', name_bm: null, choose_count: 1, sort_order: 0 }, [await dish('Lamb')])
    await deletePackage(db, id)
    expect(await deleteGroup(db, g)).toBe(false)
  })
})

describe('checkMenuChoices', () => {
  const groups = [
    { id: 1, choose_count: 1, items: [{ id: 10 }, { id: 11 }] },
    { id: 2, choose_count: 2, items: [{ id: 20 }, { id: 21 }, { id: 22 }] },
  ]

  it('accepts exactly choose_count distinct items from each group', () => {
    expect(checkMenuChoices(groups, { g1: '10', g2: ['20', '22'] })).toEqual({ choices: { 1: [10], 2: [20, 22] }, bad: [] })
  })

  it('flags missing, too many, duplicate or foreign items', () => {
    expect(checkMenuChoices(groups, {}).bad).toEqual([1, 2])
    expect(checkMenuChoices(groups, { g1: ['10', '11'], g2: ['20', '20'] }).bad).toEqual([1, 2])
    expect(checkMenuChoices(groups, { g1: '20', g2: ['20', '99'] }).bad).toEqual([1, 2])
  })

  it('has nothing to check when there are no groups', () => {
    expect(checkMenuChoices([], { g1: '10' })).toEqual({ choices: {}, bad: [] })
  })
})

describe('GET /packages (selector)', () => {
  const get = async (q = '') => (await app.request(`/packages${q}`, {}, env)).text()

  beforeEach(async () => {
    await createPackage(db, pkg({ slug: 'hall-only', name: 'Hall Only', service_type: 'in_house' }))
    await createPackage(db, pkg({ slug: 'out-only', name: 'Out Only', service_type: 'outside', cuisine_id: malay }))
    await createBranch(db, branchInput({ name: 'Shah Alam', hall_capacity: 150 }))
  })

  it('starts with the event location', async () => {
    const html = await get()
    expect(html).toContain('Where Is Your Event?')
    expect(html).toContain('value="in_house"')
  })

  it('shows only cuisines that have packages for the chosen location', async () => {
    const html = await get('?service=outside')
    expect(html).toContain('value="malay"')
    expect(html).not.toContain('value="arab"')
  })

  it('an unknown location falls back to the first step', async () => {
    expect(await get('?service=moon&cuisine=arab')).toContain('Where Is Your Event?')
  })

  it('skips the menu step when the package has no groups and shows hall branches', async () => {
    const html = await get('?service=in_house&cuisine=arab&package=hall-only')
    expect(html).toContain('Event Details')
    expect(html).not.toContain('Customise Your Menu')
    expect(html).toContain('Shah Alam (hall up to 150 pax)')
    expect(html).toContain('action="/api/enquiries/booking"')
  })

  it('asks for address fields and mentions the delivery fee for outside catering', async () => {
    const html = await get('?service=outside&cuisine=malay&package=out-only')
    expect(html).toContain('name="postcode"')
    expect(html).toContain('delivery fee')
    expect(html).not.toContain('name="branch_id"')
  })

  it('a package card link fills in the location for a one-way package', async () => {
    expect(await get('?cuisine=malay&package=out-only')).toContain('Event Details')
  })

  it('shows the menu step until each group has the right number of dishes', async () => {
    const id = (await getPublishedPackageBySlug(db, 'hall-only'))!.id
    const [a, b] = [await dish('Lamb'), await dish('Chicken')]
    const g = await createGroup(db, { package_id: id, name: 'Mains', name_bm: null, choose_count: 1, sort_order: 0 }, [a, b])
    const q = '?service=in_house&cuisine=arab&package=hall-only'

    expect(await get(q)).toContain('Customise Your Menu')
    expect(await get(`${q}&menu=1&g${g}=${a}&g${g}=${b}`)).toContain('Please choose exactly 1.')
    const html = await get(`${q}&menu=1&g${g}=${a}`)
    expect(html).toContain('Event Details')
    expect(html).toContain(`name="g${g}" value="${a}"`)
  })
})
