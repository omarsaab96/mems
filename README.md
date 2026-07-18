# Mems

Mems is a shared memory space for couples. Each partner has their own account, and both partners belong to one shared couple space where they can create memories, upload and organize photos/videos, run photo voting sessions, build albums, and maintain a shared timeline.

## Tech Stack

The MVP uses:

- **Next.js** for the full-stack web app foundation.
- **React** for the interactive workspace UI.
- **TypeScript** for typed product entities and safer refactoring.
- **Tailwind CSS** for fast, responsive UI styling.
- **MongoDB** as the planned database.
- **Mongoose** for MongoDB schemas/models.
- **Lucide React** for interface icons.

Planned later additions:

- **Auth.js / NextAuth** for partner and guest accounts.
- **S3-compatible object storage** for real photo/video uploads.
- **A background job queue** for media metadata extraction, thumbnail generation, and album processing.

## Current MVP Build

The current implementation is a working front-end MVP with typed mock data and MongoDB model definitions.

Implemented in the app:

- Login/register screen with animated romance-themed background icons.
- Post-login dashboard with sidebar navigation.
- Shared couple workspace.
- Separate partner and guest users in the demo data.
- Memory, media, vote session, album, and timeline demo records.
- Media page where photos/videos are uploaded directly for voting.
- Media page acts as a shared tray of all uploaded photos/videos.
- Media can be drag/dropped from the tray into multiple vote sessions organized by album/date.
- Each vote session can produce an album from its keepers.
- Media voting supports a resizable thumbnail grid and a swipe-card view per active session.
- Grid voting supports multi-select with Ctrl/Cmd, range select with Shift, and batch keep/delete votes.
- Vote keep/delete on photos.
- Add comments per photo.
- Build a final album from vote results.
- View a chronological shared timeline.

Backend persistence is not wired yet. The schema definitions live in `src/lib/models.ts`, and the typed demo data lives in `src/lib/entities.ts`.

## Frontend Structure

The app is split into focused components:

- `src/app/page.tsx` owns top-level MVP state and section routing.
- `src/components/auth` contains login/register UI.
- `src/components/layout` contains the app shell and sidebar navigation.
- `src/components/dashboard` contains dashboard summary views.
- `src/components/media` contains media voting, previews, modal, grid, and swipe interactions.
- `src/components/albums` contains album and media mosaic UI.
- `src/components/memories` contains memory cards.
- `src/components/timeline` contains the shared timeline view.
- `src/lib/app-types.ts` contains app-level UI types.
- `src/lib/utils.ts` contains shared UI helpers.

## Run Locally

```bash
npm install
npm run dev
```

For production validation:

```bash
npm run lint
npm run build
```

## MVP Core Entities

The MVP should focus on the core product model:

- `User`
- `Couple`
- `Memory`
- `Media`
- `VoteSession`
- `Album`
- `Timeline`

In MongoDB, these entities will typically map to collections, not SQL tables. Each collection contains documents for that entity.

## Entity Notes

### User

Represents one person using Mems.

Each partner has their own account. Family and friends may also have user accounts when they are invited to vote, comment, or view shared content.

### Couple

Represents the shared space between two partners.

A couple connects two partner users and owns the shared memories, media, groups, vote sessions, albums, and timeline.

### Memory

Represents a meaningful event, trip, milestone, place, or shared experience.

Examples:

- First apartment
- Paris trip
- Engagement day
- Summer 2026

Memories belong to the couple, not to one individual partner.

### Media

Represents uploaded photos and videos.

Media can be organized by date, place, memory, or custom groups. Media can also be included in voting sessions, comments, albums, and timeline items.
For the current MVP, uploaded media goes directly into the media voting workflow. Grouping by date, place, and memory is intentionally deferred.

### VoteSession

Represents a voting workflow for deciding which photos/videos to keep.

Partners and invited family/friends can vote and comment on media. When voting is complete, the couple can use the selected media to create a final album.

### Album

Represents a curated final collection of selected photos and videos.

Albums may be created manually or from the result of a vote session. Albums should support ordering, cover media, captions, and sharing.

### Timeline

Represents the couple's shared chronological story.

Timeline items can include text, photos, videos, albums, memories, and other meaningful events. The timeline should reference the related entity when possible instead of duplicating all data.

## MVP Media Flow

1. Upload photos and videos into the couple's shared media library.
2. Auto-detect metadata where possible, such as capture date, media type, and location.
3. Sort uploaded media from the tray into vote sessions by album/date.
4. Partners and invited people vote and comment on each photo/video in a session.
5. Close the vote session and review the results.
6. Create a final album from the keepers in that vote session.
7. Add the album, memory, photos/videos, or text updates to the couple timeline.

## Later Entities

For "everything a couple needs," later entities could include:

- `JournalEntry`
- `DatePlan`
- `Wishlist`
- `Anniversary`
- `SharedTask`
- `GiftIdea`
- `PrivateNote`
- `Invitation`
- `Notification`
