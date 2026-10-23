import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { runMigrations } from './migrate.js';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  await runMigrations();

  await db.transaction(async (tx) => {
    await tx.prepare('DELETE FROM reports').run();
    await tx.prepare('DELETE FROM comments').run();
    await tx.prepare('DELETE FROM ratings').run();
    await tx.prepare('DELETE FROM idea_tags').run();
    await tx.prepare('DELETE FROM tags').run();
    await tx.prepare('DELETE FROM ideas').run();
    await tx.prepare('DELETE FROM users').run();
  });

  const saltRounds = 10;
  const commonPasswordHash = await bcrypt.hash('password123', saltRounds);

  // 10+ realistic users
  const usersData = [
    {
      name: 'Elena Rostova',
      email: 'admin@ideapulse.dev',
      role: 'admin',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      bio: 'Platform Administrator & Product Architect. Passionate about community-driven innovation.'
    },
    {
      name: 'Marcus Chen',
      email: 'marcus@techventures.io',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Serial builder, indie hacker, and full-stack systems engineer.'
    },
    {
      name: 'Sophia Patel',
      email: 'sophia@designstudio.co',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Design systems nerd, accessible UI advocate, and UX researcher.'
    },
    {
      name: 'David Kim',
      email: 'david@greenfuture.org',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      bio: 'Climate tech advocate, circular economy enthusiast, and angel investor.'
    },
    {
      name: 'Amara Okafor',
      email: 'amara@edutech.global',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      bio: 'Building accessible learning tools for underprivileged students worldwide.'
    },
    {
      name: 'Liam O’Connor',
      email: 'liam@finflow.xyz',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      bio: 'Fintech dev, micro-SaaS experimenter, and privacy-first software fan.'
    },
    {
      name: 'Zoe Vance',
      email: 'zoe@healthloop.ai',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      bio: 'Biotech researcher and preventive health hardware creator.'
    },
    {
      name: 'Lucas Silva',
      email: 'lucas@remoteworker.me',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
      bio: 'Remote team productivity consultant and asynchronous collaboration tooling nerd.'
    },
    {
      name: 'Chloe Dubois',
      email: 'chloe@urbanhub.fr',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      bio: 'Urban planner, sustainable mobility enthusiast, and civic tech contributor.'
    },
    {
      name: 'Hiroshi Tanaka',
      email: 'hiroshi@craftcode.jp',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
      bio: 'Minimalist web craftsman, open source maintainer, and keyboard builder.'
    },
    {
      name: 'Nina Alvarez',
      email: 'nina@storyforge.media',
      role: 'user',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      bio: 'Audio storyteller, indie podcast producer, and narrative games enthusiast.'
    }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, avatar_url, bio)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const createdUserIds = [];
  for (const u of usersData) {
    const res = await insertUser.run(u.name, u.email, commonPasswordHash, u.role, u.avatar_url, u.bio);
    createdUserIds.push(res.lastInsertRowid);
  }
  console.log(`👤 Created ${createdUserIds.length} users.`);

  // Tags
  const tagList = [
    'AI', 'DeveloperTools', 'Productivity', 'OpenSource', 'SaaS',
    'Mobile', 'CleanTech', 'RemoteWork', 'Education', 'Accessibility',
    'Fintech', 'DesignSystems', 'Health', 'Community', 'E-commerce'
  ];
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const tagMap = {};
  for (const t of tagList) {
    await insertTag.run(t);
    const row = await db.prepare('SELECT id FROM tags WHERE name = ?').get(t);
    tagMap[t] = row.id;
  }

  // 22 realistic ideas across categories
  const ideasData = [
    {
      userIndex: 1, // Marcus
      title: 'DevPulse: Ambient Developer Health & Ergonomic Monitor',
      pitch: 'A privacy-first desktop tray app that monitors coding posture, eye strain, and breaks without webcams.',
      description: 'DevPulse uses keyboard/mouse cadence and gentle ambient sensor algorithms to detect prolonged rigid postures and cognitive fatigue. Unlike invasive webcam tools, it is 100% offline and privacy-respecting. It suggests 20-second micro-stretches and adjusts screen color warmth based on deep work duration.',
      category: 'Tech',
      tags: ['DeveloperTools', 'Health', 'Productivity']
    },
    {
      userIndex: 2, // Sophia
      title: 'PaletteCraft: Contrast-First Accessible Design System Generator',
      pitch: 'Generate production-ready Tailwind and CSS design systems that automatically guarantee WCAG AAA compliance.',
      description: 'Designers and developers often struggle to maintain accessible contrast ratios across dark and light modes. PaletteCraft computes perceptual lightness (APCA & WCAG 2.1) in real-time, auto-generating balanced semantic color scales, focus states, and downloadable tokens for Figma and CSS.',
      category: 'Design',
      tags: ['DesignSystems', 'Accessibility', 'DeveloperTools']
    },
    {
      userIndex: 3, // David
      title: 'Neighborhood Solar Share: Hyper-Local Renewable Energy Credits',
      pitch: 'Peer-to-peer microgrid credit exchange connecting rooftop solar owners with apartment renters in the same district.',
      description: 'Renters currently have no direct way to purchase rooftop solar energy generated on their own block. Neighborhood Solar Share allows homeowners with excess solar generation to sell virtual green credits directly to adjacent tenants at a discount relative to municipal utility peak rates.',
      category: 'Social',
      tags: ['CleanTech', 'Community']
    },
    {
      userIndex: 4, // Amara
      title: 'PaperLight: Offline-First Interactive Micro-Curricula for Low-Bandwidth Regions',
      pitch: 'Compress entire STEM courses into 2MB SQLite packages that run smoothly on 10-year-old Android devices.',
      description: 'High-bandwidth video lectures fail millions of students in low-connectivity zones. PaperLight provides rich interactive diagrams, simulations, and quiz engines packaged into tiny self-contained offline files that synchronize progress via Bluetooth or intermittent GSM bursts.',
      category: 'Education',
      tags: ['Education', 'Accessibility', 'Mobile']
    },
    {
      userIndex: 5, // Liam
      title: 'SubscriptionShield: Single-Use Privacy Cards with Auto-Cancel Rules',
      pitch: 'Virtual debit cards that automatically self-destruct or cap charges when free trial periods end.',
      description: 'Unwanted recurring subscriptions cost average consumers over $300 annually. SubscriptionShield generates single-merchant virtual debit cards linked to your primary bank with enforced hard caps, auto-pause after day 29 of a trial, and zero merchant lock-in.',
      category: 'Business',
      tags: ['Fintech', 'SaaS', 'Productivity']
    },
    {
      userIndex: 6, // Zoe
      title: 'CircadianWake: Non-Invasive Sunlight Simulation for Shift Workers',
      pitch: 'Smart home lighting orchestrator that resets sleep phases for night-shift healthcare workers.',
      description: 'Night shifts disrupt natural melatonin cycles, leading to acute cognitive fatigue. CircadianWake coordinates ambient smart bulbs to simulate dusk and dawn shifts tailored to non-standard hospital work rosters, verified by smart ring sleep metrics.',
      category: 'Tech',
      tags: ['Health', 'Productivity']
    },
    {
      userIndex: 7, // Lucas
      title: 'AsyncStandup: Frictionless Voice-to-Action Daily Huddles',
      pitch: 'Record a 45-second voice note that auto-extracts blockers, Jira ticket linkages, and PR reviews.',
      description: 'Traditional morning video standups break deep flow state. AsyncStandup lets engineers speak freely for under a minute; our localized parser converts speech into crisp status bullets, flags blocked colleagues, and updates project management trackers automatically.',
      category: 'Tech',
      tags: ['RemoteWork', 'Productivity', 'AI']
    },
    {
      userIndex: 8, // Chloe
      title: 'Parklet: Community Repurposing of Vacant Urban Curbs',
      pitch: 'Civic crowdfunding & permit-streamlining platform to turn empty parking spots into mini gardens.',
      description: 'Urban areas need more green public spaces. Parklet provides open-source modular deck blueprints, coordinates local neighbor funding, and handles municipal temporary permit applications so citizens can transform unused curbs into pollinator hubs and community benches.',
      category: 'Social',
      tags: ['Community', 'CleanTech']
    },
    {
      userIndex: 9, // Hiroshi
      title: 'TinyStatic: The 0KB Framework for Hyper-Fast Markdown Docs',
      pitch: 'An ultra-lightweight static site generator that produces vanilla HTML with instant page transitions and zero JS runtime.',
      description: 'Modern documentation sites have become bloated with megabytes of JavaScript frameworks. TinyStatic compiles Markdown into pristine, accessible HTML and inline semantic CSS. Benchmarks show sub-50ms Time to Interactive even on 3G connections.',
      category: 'Tech',
      tags: ['OpenSource', 'DeveloperTools']
    },
    {
      userIndex: 10, // Nina
      title: 'AudioCanvas: Interactive Spatial Audio Storytelling for Podcasts',
      pitch: 'A browser-based editor that lets indie podcasters craft immersive binaural audio soundscapes with drag-and-drop ease.',
      description: 'Producing high-fidelity 3D spatial audio usually requires expensive digital audio workstations. AudioCanvas brings a visual canvas where podcast creators can position voices, Foley effects, and ambient sounds in a 360-degree soundfield with instant browser preview.',
      category: 'Design',
      tags: ['DesignSystems', 'OpenSource']
    },
    {
      userIndex: 1, // Marcus
      title: 'GitResume: Verified Open Source Contribution Portfolio',
      pitch: 'Turn meaningful pull requests, architectural reviews, and RFCs into an interactive developer showcase.',
      description: 'Traditional resumes do not capture how software engineers communicate in code reviews, debug tricky race conditions, or mentor juniors. GitResume aggregates your merged PRs, GitHub discussions, and commit narratives into a clean, verifiable showcase for hiring teams.',
      category: 'Business',
      tags: ['DeveloperTools', 'OpenSource', 'Productivity']
    },
    {
      userIndex: 2, // Sophia
      title: 'FormFlow: Drop-in Micro-Surveys with Zero Drop-off',
      pitch: 'One-question interactive widgets that integrate seamlessly inside SaaS apps without interrupting UX.',
      description: 'Pop-up surveys often alienate users with intrusive multi-page questionnaires. FormFlow provides delightful, keyboard-navigable 1-click micro-interactions that trigger during natural user success moments, boosting feedback collection rates by 400%.',
      category: 'Design',
      tags: ['SaaS', 'Productivity']
    },
    {
      userIndex: 3, // David
      title: 'RepairCafe Online: Peer-to-Peer Fix-It Live Streaming',
      pitch: 'Connect with local tinkerers and retired engineers via video to troubleshoot and repair home electronics.',
      description: 'Billions of pounds of salvageable electronics hit landfills each year simply because owners lack repair guidance. RepairCafe connects consumers with skilled community fixers who provide step-by-step video guidance to diagnose faults and replace components safely.',
      category: 'Social',
      tags: ['Community', 'CleanTech']
    },
    {
      userIndex: 4, // Amara
      title: 'MathPlay: Visual Proofs and Geometry for Elementary Learners',
      pitch: 'Touch-first interactive geometric puzzles that turn abstract mathematical theorems into intuitive tactile play.',
      description: 'Memorizing formulas causes math anxiety in young learners. MathPlay uses dynamic visual proofs where kids fold polygons, balance weights on levers, and manipulate curves to understand why equations work before ever seeing algebraic notation.',
      category: 'Education',
      tags: ['Education', 'Accessibility']
    },
    {
      userIndex: 5, // Liam
      title: 'InvoiceRadar: Automated Late-Payment Chaser for Freelancers',
      pitch: 'Polite, automated escalation workflows that follow up on overdue client invoices without awkwardness.',
      description: 'Solo freelancers lose hours chasing overdue payments. InvoiceRadar plugs into QuickBooks, Stripe, or Xero and sends courteous, escalating reminders with one-click payment links, offering installment split options when clients cite cashflow bottlenecks.',
      category: 'Business',
      tags: ['Fintech', 'Productivity', 'SaaS']
    },
    {
      userIndex: 6, // Zoe
      title: 'PillSync: Smart Cap and NFC Pill Organizer for Complex Meds',
      pitch: 'Affordable NFC-enabled bottle caps that track dosage schedules and alert caregivers if doses are missed.',
      description: 'Medication non-adherence leads to hundreds of thousands of preventable hospital readmissions. PillSync offers reusable NFC caps that register a timestamp whenever opened, logging into a secure mobile health app that notifies designated family members if an essential dose is delayed.',
      category: 'Tech',
      tags: ['Health', 'Mobile']
    },
    {
      userIndex: 7, // Lucas
      title: 'FocusRooms: Virtual Silent Coworking with Pomodoro Anchors',
      pitch: 'Join focused, distraction-free video rooms with gentle ambient audio and collective 50-minute work sprints.',
      description: 'Working from home can foster isolation and digital distraction. FocusRooms matches remote knowledge workers into quiet rooms of 4 people. No small talk—everyone commits a single goal for the session in chat, works with gentle lo-fi audio, and celebrates during the 10-minute break.',
      category: 'Social',
      tags: ['RemoteWork', 'Productivity', 'Community']
    },
    {
      userIndex: 8, // Chloe
      title: 'CompostCycle: Neighborhood Food Waste Bucket Swapping',
      pitch: 'A community route coordinator for residential organic waste collection and community garden delivery.',
      description: 'Many municipal areas lack curbside composting services. CompostCycle empowers neighborhood bike volunteers to collect sealed food scrap buckets and deliver them to community gardens and urban farms in exchange for fresh local produce shares.',
      category: 'Social',
      tags: ['CleanTech', 'Community']
    },
    {
      userIndex: 9, // Hiroshi
      title: 'KeyboardLayout Lab: Custom Ergonomic Layout Optimizer',
      pitch: 'Simulate finger travel distance and effort across QWERTY, Dvorak, Colemak, and custom split layouts.',
      description: 'Repetitive strain injury plagues software engineers and typists. KeyboardLayout Lab lets users upload sample code repositories or prose to measure exact finger travel in meters, inward/outward roll frequencies, and lateral stretch metrics, producing optimal custom key mappings.',
      category: 'Other',
      tags: ['DeveloperTools', 'OpenSource']
    },
    {
      userIndex: 10, // Nina
      title: 'BookClub Audio: Social Annotation for Audiobooks',
      pitch: 'Drop audio bookmarks, share timestamped voice reactions, and discuss chapters with reading buddies.',
      description: 'Audiobook listeners lack the margin-scribbling and book-club annotation experience of physical book readers. BookClub Audio enables listeners to clip 15-second audio excerpts, attach spoken thoughts, and listen together synchronously.',
      category: 'Education',
      tags: ['Community', 'Mobile']
    },
    {
      userIndex: 1, // Marcus
      title: 'LocalMock: Instant Zero-Config Offline API Mocking Engine',
      pitch: 'Inspect network requests and automatically generate reproducible mock HTTP fixtures with zero code.',
      description: 'Frontend developers waste countless hours spinning up mock servers or waiting for backend endpoints. LocalMock runs as a local proxy that captures real responses and allows one-click switching to synthetic offline mock states with variable latency and error simulation.',
      category: 'Tech',
      tags: ['DeveloperTools', 'OpenSource']
    },
    {
      userIndex: 2, // Sophia
      title: 'TypeSpec: Interactive Typography Scale & Pairings Playground',
      pitch: 'Harmonize font pairings, optical kerning, and fluid modular scales with responsive CSS export.',
      description: 'Designing typographic hierarchy across screen sizes is tricky. TypeSpec visualizes fluid typography clamp() equations, vertical baseline rhythm, and heading contrast in side-by-side editorial layouts.',
      category: 'Design',
      tags: ['DesignSystems']
    }
  ];

  const insertIdea = db.prepare(`
    INSERT INTO ideas (user_id, title, pitch, description, category, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const insertIdeaTag = db.prepare(`
    INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)
  `);

  const createdIdeaIds = [];
  let dayOffset = -25;
  for (const item of ideasData) {
    const ownerId = createdUserIds[item.userIndex];
    const offsetStr = `${dayOffset} days`;
    const res = await insertIdea.run(ownerId, item.title, item.pitch, item.description, item.category, offsetStr);
    const ideaId = res.lastInsertRowid;
    createdIdeaIds.push({ id: ideaId, ownerId });
    dayOffset = Math.min(0, dayOffset + 1);

    for (const tag of item.tags) {
      if (tagMap[tag]) {
        await insertIdeaTag.run(ideaId, tagMap[tag]);
      }
    }
  }
  console.log(`💡 Created ${createdIdeaIds.length} ideas with categories and tags.`);

  // Insert ratings with realistic distribution (ensure no self-rating!)
  const sampleReviews = [
    { score: 5, text: 'Brilliant concept! This solves an acute real-world pain point for me.' },
    { score: 5, text: 'Super clear pitch and strong execution potential. Would pay for this on day one.' },
    { score: 4, text: 'Very promising idea. Would love to see deeper technical details on privacy.' },
    { score: 4, text: 'Solid direction! Consider integrating with existing open standards to scale faster.' },
    { score: 3, text: 'Interesting angle, though competitive alternatives exist in this market.' },
    { score: 2, text: 'Has potential, but monetization and user retention seem challenging.' },
    { score: 5, text: 'Incredible initiative. We need this built yesterday!' }
  ];

  const insertRating = db.prepare(`
    INSERT INTO ratings (user_id, idea_id, score, review_text, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  let ratingCount = 0;
  for (let idx = 0; idx < createdIdeaIds.length; idx++) {
    const idea = createdIdeaIds[idx];
    // Brand new drafts have 0 ratings
    if (idx === createdIdeaIds.length - 1 || idx === createdIdeaIds.length - 2) {
      continue;
    }

    const candidateUsers = createdUserIds.filter(uid => uid !== idea.ownerId);
    
    // Varied volume: early ideas get 6-10 ratings, middle get 1-3, fresh get 0
    let numReviewers;
    if (idx < 3) {
      numReviewers = Math.min(candidateUsers.length, 8); // Breakouts
    } else if (idx % 4 === 0) {
      numReviewers = 1; // Early single ballot
    } else if (idx % 3 === 0) {
      numReviewers = 2;
    } else {
      numReviewers = 3 + (idx % 4);
    }

    const selectedUsers = candidateUsers.slice(0, numReviewers);

    for (let i = 0; i < selectedUsers.length; i++) {
      const reviewerId = selectedUsers[i];
      const reviewTemplate = sampleReviews[(idea.id + reviewerId + i) % sampleReviews.length];
      const timeOffset = `-${(i * 2 + 1)} days`;

      await insertRating.run(reviewerId, idea.id, reviewTemplate.score, reviewTemplate.text, timeOffset);
      ratingCount++;
    }
  }
  console.log(`⭐ Seeded ${ratingCount} authentic ratings with realistic variance (including 0-rated fresh drafts).`);

  // Insert comments
  const sampleComments = [
    'Have you considered making the client open-source while offering cloud sync as a subscription?',
    'I tested a similar prototype last year. The hardest part was user onboarding friction—keep that in mind!',
    'Count me in for the beta testing group! Reached out via your profile.',
    'What is your target launch date? Would love to feature this in our community newsletter.'
  ];

  const insertComment = db.prepare(`
    INSERT INTO comments (user_id, idea_id, content, created_at)
    VALUES (?, ?, ?, datetime('now', ?))
  `);

  let commentCount = 0;
  for (let i = 0; i < createdIdeaIds.length; i++) {
    const idea = createdIdeaIds[i];
    const commenterId = createdUserIds[(i + 3) % createdUserIds.length];
    if (commenterId !== idea.ownerId) {
      const commentText = sampleComments[i % sampleComments.length];
      await insertComment.run(commenterId, idea.id, commentText, `-${i} hours`);
      commentCount++;
    }
  }
  console.log(`💬 Seeded ${commentCount} discussion comments.`);

  // Insert a couple of sample reports for moderation testing
  const insertReport = db.prepare(`
    INSERT INTO reports (reporter_id, idea_id, reason, status, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  await insertReport.run(createdUserIds[2], createdIdeaIds[0].id, 'Check whether marketing claims meet community standards.', 'pending', '-1 days');
  await insertReport.run(createdUserIds[3], createdIdeaIds[5].id, 'Duplicate or overlapping submission query.', 'pending', '-2 hours');
  console.log(`🛡️ Seeded moderation reports.`);

  console.log('✅ Seeding completed successfully!');
}

// Allow direct execution: `node src/db/seed.js`
if (process.argv[1] === import.meta.url || process.argv[1].endsWith('seed.js')) {
  try {
    await seedDatabase();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}
