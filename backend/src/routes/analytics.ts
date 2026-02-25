import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireAgent, requireAgentPermission, AuthRequest } from '../middleware/auth';

const router = Router();

// Get agent performance analytics
router.get('/agents', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (_req: AuthRequest, res: Response) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        role: { in: ['AGENT', 'ADMIN'] }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        // Get session statistics
        const sessions = await prisma.agentSession.findMany({
          where: { agentId: agent.id },
          orderBy: { loginAt: 'desc' }
        });

        const totalSessions = sessions.length;
        const completedSessions = sessions.filter(s => s.logoutAt !== null);
        const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const avgDuration = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;
        const totalReplies = sessions.reduce((sum, s) => sum + s.replyCount, 0);

        const lastLogin = sessions[0]?.loginAt || null;
        const isOnline = sessions.some(s => s.logoutAt === null);

        // Get ticket assignment stats
        const [assignedTickets, solvedTickets] = await Promise.all([
          prisma.ticket.count({ where: { assigneeId: agent.id } }),
          prisma.ticket.count({ where: { assigneeId: agent.id, status: 'SOLVED' } })
        ]);

        return {
          agent: {
            id: agent.id,
            email: agent.email,
            name: `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || agent.email,
            role: agent.role
          },
          sessions: {
            total: totalSessions,
            totalDuration,
            avgDuration: Math.round(avgDuration),
            lastLogin,
            isOnline
          },
          tickets: {
            assigned: assignedTickets,
            solved: solvedTickets,
            solveRate: assignedTickets > 0 ? (solvedTickets / assignedTickets) * 100 : 0
          },
          replies: {
            total: totalReplies,
            avgPerSession: totalSessions > 0 ? totalReplies / totalSessions : 0
          }
        };
      })
    );

    return res.json(agentStats);
  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get system-wide statistics (admin only)
router.get('/system', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalTickets,
      totalUsers,
      totalAgents,
      ticketsByStatus,
      ticketsByPriority,
      recentTickets
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: { in: ['AGENT', 'ADMIN'] } } }),

      prisma.ticket.groupBy({
        by: ['status'],
        _count: true
      }),

      prisma.ticket.groupBy({
        by: ['priority'],
        _count: true
      }),

      prisma.ticket.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: {
            select: { email: true, firstName: true, lastName: true }
          },
          assignee: {
            select: { email: true, firstName: true, lastName: true }
          }
        }
      })
    ]);

    const statusMap = ticketsByStatus.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const priorityMap = ticketsByPriority.reduce((acc, item) => {
      acc[item.priority.toLowerCase()] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      overview: {
        totalTickets,
        totalUsers,
        totalAgents
      },
      tickets: {
        byStatus: statusMap,
        byPriority: priorityMap,
        recent: recentTickets
      }
    });
  } catch (error) {
    console.error('Error fetching system analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch system analytics' });
  }
});

// Get agent session history (admin only)
router.get('/agents/:agentId/sessions', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const sessions = await prisma.agentSession.findMany({
      where: { agentId },
      orderBy: { loginAt: 'desc' },
      take: limit,
      include: {
        agent: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    });

    return res.json(sessions);
  } catch (error) {
    console.error('Error fetching agent sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get tickets solved per month for a specific year
router.get('/solved-by-month', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Get tickets solved in the specified year grouped by month
    const solvedByMonth = await prisma.$queryRaw<Array<{ month: number; count: bigint }>>`
      SELECT
        EXTRACT(MONTH FROM "solvedAt") as month,
        COUNT(*) as count
      FROM "Ticket"
      WHERE "solvedAt" IS NOT NULL
        AND EXTRACT(YEAR FROM "solvedAt") = ${year}
      GROUP BY EXTRACT(MONTH FROM "solvedAt")
      ORDER BY month ASC
    `;

    // Get available years for the selector
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "solvedAt") as year
      FROM "Ticket"
      WHERE "solvedAt" IS NOT NULL
      ORDER BY year DESC
    `;

    // Create array with all 12 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = monthNames.map((name, index) => {
      const found = solvedByMonth.find((item) => Number(item.month) === index + 1);
      return {
        month: index + 1,
        name,
        count: found ? Number(found.count) : 0
      };
    });

    return res.json({
      year,
      data: monthlyData,
      availableYears: availableYears.map((y) => Number(y.year))
    });
  } catch (error) {
    console.error('Error fetching solved by month:', error);
    return res.status(500).json({ error: 'Failed to fetch solved by month data' });
  }
});

// Timezone to country mapping
const timezoneToCountry: Record<string, string> = {
  // Europe - Western
  'Europe/Amsterdam': 'Netherlands',
  'Europe/London': 'United Kingdom',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'Europe/Madrid': 'Spain',
  'Europe/Rome': 'Italy',
  'Europe/Brussels': 'Belgium',
  'Europe/Vienna': 'Austria',
  'Europe/Zurich': 'Switzerland',
  'Europe/Luxembourg': 'Luxembourg',
  'Europe/Monaco': 'Monaco',
  'Europe/Andorra': 'Andorra',
  'Europe/San_Marino': 'San Marino',
  'Europe/Vatican': 'Vatican City',
  'Europe/Gibraltar': 'Gibraltar',
  // Europe - Nordic
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Reykjavik': 'Iceland',
  'Atlantic/Faroe': 'Faroe Islands',
  // Europe - Central & Eastern
  'Europe/Warsaw': 'Poland',
  'Europe/Prague': 'Czech Republic',
  'Europe/Budapest': 'Hungary',
  'Europe/Bratislava': 'Slovakia',
  'Europe/Ljubljana': 'Slovenia',
  'Europe/Zagreb': 'Croatia',
  'Europe/Belgrade': 'Serbia',
  'Europe/Sarajevo': 'Bosnia and Herzegovina',
  'Europe/Podgorica': 'Montenegro',
  'Europe/Skopje': 'North Macedonia',
  'Europe/Tirana': 'Albania',
  'Europe/Sofia': 'Bulgaria',
  'Europe/Bucharest': 'Romania',
  'Europe/Chisinau': 'Moldova',
  'Europe/Kiev': 'Ukraine',
  'Europe/Kyiv': 'Ukraine',
  'Europe/Minsk': 'Belarus',
  // Europe - Baltic
  'Europe/Vilnius': 'Lithuania',
  'Europe/Riga': 'Latvia',
  'Europe/Tallinn': 'Estonia',
  // Europe - Southern
  'Europe/Athens': 'Greece',
  'Europe/Lisbon': 'Portugal',
  'Europe/Dublin': 'Ireland',
  'Europe/Malta': 'Malta',
  'Europe/Nicosia': 'Cyprus',
  // Europe - Russia & Turkey
  'Europe/Moscow': 'Russia',
  'Europe/Kaliningrad': 'Russia',
  'Europe/Samara': 'Russia',
  'Europe/Istanbul': 'Turkey',
  // Americas - United States
  'America/New_York': 'United States',
  'America/Los_Angeles': 'United States',
  'America/Chicago': 'United States',
  'America/Denver': 'United States',
  'America/Phoenix': 'United States',
  'America/Anchorage': 'United States',
  'America/Honolulu': 'United States',
  'America/Detroit': 'United States',
  'America/Indiana/Indianapolis': 'United States',
  'America/Boise': 'United States',
  'America/Juneau': 'United States',
  'Pacific/Honolulu': 'United States',
  // Americas - Canada
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'America/Montreal': 'Canada',
  'America/Edmonton': 'Canada',
  'America/Winnipeg': 'Canada',
  'America/Halifax': 'Canada',
  'America/St_Johns': 'Canada',
  'America/Regina': 'Canada',
  // Americas - Mexico & Central America
  'America/Mexico_City': 'Mexico',
  'America/Cancun': 'Mexico',
  'America/Tijuana': 'Mexico',
  'America/Monterrey': 'Mexico',
  'America/Guatemala': 'Guatemala',
  'America/Belize': 'Belize',
  'America/El_Salvador': 'El Salvador',
  'America/Tegucigalpa': 'Honduras',
  'America/Managua': 'Nicaragua',
  'America/Costa_Rica': 'Costa Rica',
  'America/Panama': 'Panama',
  // Americas - Caribbean
  'America/Havana': 'Cuba',
  'America/Jamaica': 'Jamaica',
  'America/Port-au-Prince': 'Haiti',
  'America/Santo_Domingo': 'Dominican Republic',
  'America/Puerto_Rico': 'Puerto Rico',
  'America/Nassau': 'Bahamas',
  'America/Barbados': 'Barbados',
  'America/Trinidad': 'Trinidad and Tobago',
  'America/Curacao': 'Curacao',
  'America/Aruba': 'Aruba',
  'America/Martinique': 'Martinique',
  'America/Guadeloupe': 'Guadeloupe',
  // Americas - South America
  'America/Sao_Paulo': 'Brazil',
  'America/Rio_Branco': 'Brazil',
  'America/Manaus': 'Brazil',
  'America/Fortaleza': 'Brazil',
  'America/Recife': 'Brazil',
  'America/Buenos_Aires': 'Argentina',
  'America/Cordoba': 'Argentina',
  'America/Mendoza': 'Argentina',
  'America/Lima': 'Peru',
  'America/Bogota': 'Colombia',
  'America/Santiago': 'Chile',
  'America/Caracas': 'Venezuela',
  'America/Montevideo': 'Uruguay',
  'America/Asuncion': 'Paraguay',
  'America/La_Paz': 'Bolivia',
  'America/Guayaquil': 'Ecuador',
  'America/Guyana': 'Guyana',
  'America/Paramaribo': 'Suriname',
  'America/Cayenne': 'French Guiana',
  // Asia - East
  'Asia/Tokyo': 'Japan',
  'Asia/Shanghai': 'China',
  'Asia/Beijing': 'China',
  'Asia/Chongqing': 'China',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Macau': 'Macau',
  'Asia/Taipei': 'Taiwan',
  'Asia/Seoul': 'South Korea',
  'Asia/Pyongyang': 'North Korea',
  'Asia/Ulaanbaatar': 'Mongolia',
  // Asia - Southeast
  'Asia/Singapore': 'Singapore',
  'Asia/Bangkok': 'Thailand',
  'Asia/Jakarta': 'Indonesia',
  'Asia/Makassar': 'Indonesia',
  'Asia/Jayapura': 'Indonesia',
  'Asia/Manila': 'Philippines',
  'Asia/Kuala_Lumpur': 'Malaysia',
  'Asia/Kuching': 'Malaysia',
  'Asia/Ho_Chi_Minh': 'Vietnam',
  'Asia/Hanoi': 'Vietnam',
  'Asia/Phnom_Penh': 'Cambodia',
  'Asia/Vientiane': 'Laos',
  'Asia/Yangon': 'Myanmar',
  'Asia/Brunei': 'Brunei',
  'Asia/Dili': 'Timor-Leste',
  // Asia - South
  'Asia/Kolkata': 'India',
  'Asia/Mumbai': 'India',
  'Asia/Calcutta': 'India',
  'Asia/Chennai': 'India',
  'Asia/Dhaka': 'Bangladesh',
  'Asia/Colombo': 'Sri Lanka',
  'Asia/Karachi': 'Pakistan',
  'Asia/Kathmandu': 'Nepal',
  'Asia/Thimphu': 'Bhutan',
  'Indian/Maldives': 'Maldives',
  // Asia - Central
  'Asia/Almaty': 'Kazakhstan',
  'Asia/Tashkent': 'Uzbekistan',
  'Asia/Bishkek': 'Kyrgyzstan',
  'Asia/Dushanbe': 'Tajikistan',
  'Asia/Ashgabat': 'Turkmenistan',
  'Asia/Kabul': 'Afghanistan',
  // Asia - Middle East
  'Asia/Dubai': 'United Arab Emirates',
  'Asia/Riyadh': 'Saudi Arabia',
  'Asia/Tel_Aviv': 'Israel',
  'Asia/Jerusalem': 'Israel',
  'Asia/Beirut': 'Lebanon',
  'Asia/Damascus': 'Syria',
  'Asia/Amman': 'Jordan',
  'Asia/Baghdad': 'Iraq',
  'Asia/Kuwait': 'Kuwait',
  'Asia/Qatar': 'Qatar',
  'Asia/Bahrain': 'Bahrain',
  'Asia/Muscat': 'Oman',
  'Asia/Aden': 'Yemen',
  'Asia/Tehran': 'Iran',
  'Asia/Baku': 'Azerbaijan',
  'Asia/Tbilisi': 'Georgia',
  'Asia/Yerevan': 'Armenia',
  // Asia - Russia
  'Asia/Vladivostok': 'Russia',
  'Asia/Yekaterinburg': 'Russia',
  'Asia/Novosibirsk': 'Russia',
  'Asia/Krasnoyarsk': 'Russia',
  'Asia/Irkutsk': 'Russia',
  'Asia/Yakutsk': 'Russia',
  'Asia/Magadan': 'Russia',
  'Asia/Kamchatka': 'Russia',
  // Oceania - Australia
  'Australia/Sydney': 'Australia',
  'Australia/Melbourne': 'Australia',
  'Australia/Brisbane': 'Australia',
  'Australia/Perth': 'Australia',
  'Australia/Adelaide': 'Australia',
  'Australia/Darwin': 'Australia',
  'Australia/Hobart': 'Australia',
  'Australia/Canberra': 'Australia',
  // Oceania - Pacific
  'Pacific/Auckland': 'New Zealand',
  'Pacific/Wellington': 'New Zealand',
  'Pacific/Chatham': 'New Zealand',
  'Pacific/Fiji': 'Fiji',
  'Pacific/Port_Moresby': 'Papua New Guinea',
  'Pacific/Guam': 'Guam',
  'Pacific/Noumea': 'New Caledonia',
  'Pacific/Tahiti': 'French Polynesia',
  'Pacific/Samoa': 'Samoa',
  'Pacific/Tongatapu': 'Tonga',
  'Pacific/Efate': 'Vanuatu',
  'Pacific/Tarawa': 'Kiribati',
  'Pacific/Majuro': 'Marshall Islands',
  'Pacific/Palau': 'Palau',
  // Africa - North
  'Africa/Cairo': 'Egypt',
  'Africa/Casablanca': 'Morocco',
  'Africa/Tunis': 'Tunisia',
  'Africa/Algiers': 'Algeria',
  'Africa/Tripoli': 'Libya',
  'Africa/Khartoum': 'Sudan',
  // Africa - West
  'Africa/Lagos': 'Nigeria',
  'Africa/Accra': 'Ghana',
  'Africa/Abidjan': 'Ivory Coast',
  'Africa/Dakar': 'Senegal',
  'Africa/Bamako': 'Mali',
  'Africa/Ouagadougou': 'Burkina Faso',
  'Africa/Niamey': 'Niger',
  'Africa/Conakry': 'Guinea',
  'Africa/Freetown': 'Sierra Leone',
  'Africa/Monrovia': 'Liberia',
  'Africa/Banjul': 'Gambia',
  'Africa/Nouakchott': 'Mauritania',
  'Africa/Bissau': 'Guinea-Bissau',
  'Africa/Lome': 'Togo',
  'Africa/Porto-Novo': 'Benin',
  // Africa - East
  'Africa/Nairobi': 'Kenya',
  'Africa/Dar_es_Salaam': 'Tanzania',
  'Africa/Kampala': 'Uganda',
  'Africa/Addis_Ababa': 'Ethiopia',
  'Africa/Mogadishu': 'Somalia',
  'Africa/Djibouti': 'Djibouti',
  'Africa/Asmara': 'Eritrea',
  'Indian/Antananarivo': 'Madagascar',
  'Indian/Mauritius': 'Mauritius',
  'Indian/Reunion': 'Reunion',
  'Indian/Mayotte': 'Mayotte',
  'Indian/Comoro': 'Comoros',
  // Africa - Central
  'Africa/Kinshasa': 'Democratic Republic of the Congo',
  'Africa/Lubumbashi': 'Democratic Republic of the Congo',
  'Africa/Brazzaville': 'Republic of the Congo',
  'Africa/Douala': 'Cameroon',
  'Africa/Libreville': 'Gabon',
  'Africa/Malabo': 'Equatorial Guinea',
  'Africa/Bangui': 'Central African Republic',
  'Africa/Ndjamena': 'Chad',
  'Africa/Luanda': 'Angola',
  // Africa - Southern
  'Africa/Johannesburg': 'South Africa',
  'Africa/Cape_Town': 'South Africa',
  'Africa/Harare': 'Zimbabwe',
  'Africa/Lusaka': 'Zambia',
  'Africa/Maputo': 'Mozambique',
  'Africa/Gaborone': 'Botswana',
  'Africa/Windhoek': 'Namibia',
  'Africa/Maseru': 'Lesotho',
  'Africa/Mbabane': 'Eswatini',
  'Africa/Blantyre': 'Malawi',
  'Africa/Kigali': 'Rwanda',
  'Africa/Bujumbura': 'Burundi',
  // Atlantic
  'Atlantic/Reykjavik': 'Iceland',
  'Atlantic/Azores': 'Portugal',
  'Atlantic/Madeira': 'Portugal',
  'Atlantic/Canary': 'Spain',
  'Atlantic/Bermuda': 'Bermuda',
  'Atlantic/Cape_Verde': 'Cape Verde',
  // UTC/Generic (can't determine specific country, but commonly used)
  'Etc/UTC': 'Unknown',
  'Etc/GMT': 'Unknown',
  'UTC': 'Unknown'
};

// Helper function to extract country from timezone
function getCountryFromTimezone(timezone: string | null): string | null {
  if (!timezone) return null;

  // Direct match
  if (timezoneToCountry[timezone]) {
    return timezoneToCountry[timezone];
  }

  // Try to match by region (e.g., "Europe/Amsterdam" -> check if starts with "Europe/")
  const parts = timezone.split('/');
  if (parts.length >= 2) {
    // For US timezones like America/Indiana/Indianapolis
    const baseTimezone = `${parts[0]}/${parts[1]}`;
    if (timezoneToCountry[baseTimezone]) {
      return timezoneToCountry[baseTimezone];
    }
  }

  return null;
}

// Backfill ticket countries from user timezone
// This looks up users by email (not requesterId) to handle imported tickets
// where requesterId might point to a different user record than the one with timezone data
router.post('/backfill-countries', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Get all tickets without country, including requester email
    const ticketsToUpdate = await prisma.ticket.findMany({
      where: {
        country: null
      },
      include: {
        requester: {
          select: {
            email: true,
            timezone: true
          }
        }
      }
    });

    let updatedCount = 0;
    let skippedNoEmail = 0;
    let skippedNoTimezone = 0;
    let skippedNoCountryMapping = 0;
    const countryUpdates: Record<string, number> = {};
    const unmappedTimezones: Set<string> = new Set();
    const sampleSkippedEmails: string[] = [];

    for (const ticket of ticketsToUpdate) {
      const requesterEmail = ticket.requester?.email;

      if (!requesterEmail) {
        skippedNoEmail++;
        continue;
      }

      // Look up user by email to find the one with timezone data
      // This handles cases where imported tickets have requesterId pointing to
      // a zendesk-import user record, but the actual user (by email) has timezone
      const userWithTimezone = await prisma.user.findFirst({
        where: {
          email: requesterEmail,
          timezone: { not: null }
        },
        select: {
          timezone: true
        }
      });

      if (!userWithTimezone?.timezone) {
        skippedNoTimezone++;
        // Keep sample of first 10 emails that have no timezone
        if (sampleSkippedEmails.length < 10) {
          sampleSkippedEmails.push(requesterEmail);
        }
        continue;
      }

      const country = getCountryFromTimezone(userWithTimezone.timezone);
      if (country) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { country }
        });
        updatedCount++;
        countryUpdates[country] = (countryUpdates[country] || 0) + 1;
      } else {
        // Timezone exists but couldn't be mapped to a country
        skippedNoCountryMapping++;
        unmappedTimezones.add(userWithTimezone.timezone);
      }
    }

    return res.json({
      message: `Updated ${updatedCount} tickets with country data`,
      totalProcessed: ticketsToUpdate.length,
      updatedCount,
      skippedNoEmail,
      skippedNoTimezone,
      skippedNoCountryMapping,
      countryBreakdown: countryUpdates,
      unmappedTimezones: Array.from(unmappedTimezones),
      sampleSkippedEmails
    });
  } catch (error) {
    console.error('Error backfilling countries:', error);
    return res.status(500).json({ error: 'Failed to backfill countries' });
  }
});

// Backfill ticket forms based on form responses
router.post('/backfill-forms', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Get all tickets without formId that have form responses
    const ticketsWithoutForm = await prisma.ticket.findMany({
      where: {
        formId: null,
        formResponses: {
          some: {}
        }
      },
      include: {
        formResponses: {
          select: {
            fieldId: true
          }
        }
      }
    });

    // Get all form-field mappings to determine which form contains which fields
    const formFields = await prisma.formField.findMany({
      include: {
        form: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Create a map of fieldId -> formId (and form name for reporting)
    const fieldToForm = new Map<string, { formId: string; formName: string }>();
    for (const ff of formFields) {
      fieldToForm.set(ff.fieldId, { formId: ff.formId, formName: ff.form.name });
    }

    let updatedCount = 0;
    const formUpdates: Record<string, number> = {};
    const skippedNoMatch: string[] = [];
    const skippedMultipleForms: string[] = [];

    for (const ticket of ticketsWithoutForm) {
      // Find all forms that match the fields in this ticket's responses
      const matchedForms = new Set<string>();
      const matchedFormNames = new Map<string, string>();

      for (const response of ticket.formResponses) {
        const formInfo = fieldToForm.get(response.fieldId);
        if (formInfo) {
          matchedForms.add(formInfo.formId);
          matchedFormNames.set(formInfo.formId, formInfo.formName);
        }
      }

      if (matchedForms.size === 0) {
        // No matching form found for this ticket's fields
        skippedNoMatch.push(`#${ticket.ticketNumber}`);
        continue;
      }

      if (matchedForms.size > 1) {
        // Multiple forms match - pick the one with the most matching fields
        const formFieldCounts = new Map<string, number>();
        for (const response of ticket.formResponses) {
          const formInfo = fieldToForm.get(response.fieldId);
          if (formInfo) {
            formFieldCounts.set(formInfo.formId, (formFieldCounts.get(formInfo.formId) || 0) + 1);
          }
        }

        // Find form with most matches
        let bestFormId = '';
        let bestCount = 0;
        for (const [formId, count] of formFieldCounts) {
          if (count > bestCount) {
            bestCount = count;
            bestFormId = formId;
          }
        }

        if (bestFormId) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { formId: bestFormId }
          });
          const formName = matchedFormNames.get(bestFormId) || 'Unknown';
          formUpdates[formName] = (formUpdates[formName] || 0) + 1;
          updatedCount++;
        } else {
          skippedMultipleForms.push(`#${ticket.ticketNumber}`);
        }
        continue;
      }

      // Exactly one form matches
      const formId = Array.from(matchedForms)[0];
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { formId }
      });
      const formName = matchedFormNames.get(formId) || 'Unknown';
      formUpdates[formName] = (formUpdates[formName] || 0) + 1;
      updatedCount++;
    }

    return res.json({
      message: `Updated ${updatedCount} tickets with form data`,
      totalProcessed: ticketsWithoutForm.length,
      updatedCount,
      formBreakdown: formUpdates,
      skippedNoMatch: skippedNoMatch.length,
      skippedMultipleForms: skippedMultipleForms.length
    });
  } catch (error) {
    console.error('Error backfilling forms:', error);
    return res.status(500).json({ error: 'Failed to backfill forms' });
  }
});

// Get tickets by country per year
router.get('/countries-by-year', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Get tickets by country for the specified year
    const ticketsByCountry = await prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
      SELECT
        COALESCE(country, 'Unknown') as country,
        COUNT(*) as count
      FROM "Ticket"
      WHERE EXTRACT(YEAR FROM "createdAt") = ${year}
        AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 15
    `;

    // Get available years (only from 2023 onwards as per user request)
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "createdAt") as year
      FROM "Ticket"
      WHERE EXTRACT(YEAR FROM "createdAt") >= 2023
      ORDER BY year DESC
    `;

    const countryData = ticketsByCountry.map((item) => ({
      name: item.country,
      count: Number(item.count)
    }));

    return res.json({
      year,
      data: countryData,
      availableYears: availableYears.map((y) => Number(y.year))
    });
  } catch (error) {
    console.error('Error fetching countries by year:', error);
    return res.status(500).json({ error: 'Failed to fetch countries by year data' });
  }
});

// Get tickets by form per year
router.get('/forms-by-year', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Get tickets by form for the specified year
    const ticketsByForm = await prisma.$queryRaw<Array<{ formId: string; name: string; count: bigint }>>`
      SELECT
        t."formId",
        f.name,
        COUNT(*) as count
      FROM "Ticket" t
      JOIN "Form" f ON t."formId" = f.id
      WHERE EXTRACT(YEAR FROM t."createdAt") = ${year}
        AND t."formId" IS NOT NULL
      GROUP BY t."formId", f.name
      ORDER BY count DESC
      LIMIT 10
    `;

    // Get available years (only from 2023 onwards)
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "createdAt") as year
      FROM "Ticket"
      WHERE EXTRACT(YEAR FROM "createdAt") >= 2023
        AND "formId" IS NOT NULL
      ORDER BY year DESC
    `;

    const formData = ticketsByForm.map((item) => ({
      name: item.name,
      count: Number(item.count)
    }));

    return res.json({
      year,
      data: formData,
      availableYears: availableYears.map((y) => Number(y.year))
    });
  } catch (error) {
    console.error('Error fetching forms by year:', error);
    return res.status(500).json({ error: 'Failed to fetch forms by year data' });
  }
});

// Get tickets by channel with year filter (admin only)
router.get('/channel-by-year', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const ticketsByChannel = await prisma.ticket.groupBy({
      by: ['channel'],
      _count: true,
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      }
    });

    const channelData = ticketsByChannel.map(item => ({
      name: item.channel,
      value: item._count
    }));

    // Get available years
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "createdAt")::integer as year
      FROM "Ticket"
      ORDER BY year DESC
    `;

    return res.json({
      year,
      data: channelData,
      availableYears: availableYears.map((y) => y.year)
    });
  } catch (error) {
    console.error('Error fetching channel by year:', error);
    return res.status(500).json({ error: 'Failed to fetch channel data' });
  }
});

// Get tickets by priority with year filter (admin only)
router.get('/priority-by-year', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const ticketsByPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      _count: true,
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      }
    });

    const priorityData = ticketsByPriority.map(item => ({
      name: item.priority,
      value: item._count,
      label: item.priority.charAt(0) + item.priority.slice(1).toLowerCase()
    }));

    // Get available years
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "createdAt")::integer as year
      FROM "Ticket"
      ORDER BY year DESC
    `;

    return res.json({
      year,
      data: priorityData,
      availableYears: availableYears.map((y) => y.year)
    });
  } catch (error) {
    console.error('Error fetching priority by year:', error);
    return res.status(500).json({ error: 'Failed to fetch priority data' });
  }
});

// Get tickets by day of week with year filter (admin only)
router.get('/weekday-by-year', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const weekdayDistribution = await prisma.$queryRaw`
      SELECT EXTRACT(DOW FROM "createdAt")::integer as day, COUNT(*)::integer as count
      FROM "Ticket"
      WHERE "createdAt" >= ${startDate} AND "createdAt" < ${endDate}
      GROUP BY EXTRACT(DOW FROM "createdAt")
      ORDER BY day
    `;

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayData = weekdayNames.map((name, i) => {
      const found = (weekdayDistribution as any[]).find((d: any) => d.day === i);
      return {
        name,
        value: found ? Number(found.count) : 0
      };
    });

    // Get available years
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "createdAt")::integer as year
      FROM "Ticket"
      ORDER BY year DESC
    `;

    return res.json({
      year,
      data: weekdayData,
      availableYears: availableYears.map((y) => y.year)
    });
  } catch (error) {
    console.error('Error fetching weekday by year:', error);
    return res.status(500).json({ error: 'Failed to fetch weekday data' });
  }
});

// Get tickets by hour of day with year filter (admin only)
router.get('/hourly-by-year', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const hourlyDistribution = await prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM "createdAt")::integer as hour, COUNT(*)::integer as count
      FROM "Ticket"
      WHERE "createdAt" >= ${startDate} AND "createdAt" < ${endDate}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const found = (hourlyDistribution as any[]).find((h: any) => h.hour === i);
      return {
        hour: i,
        count: found ? Number(found.count) : 0,
        label: `${i}:00`
      };
    });

    // Get available years
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "createdAt")::integer as year
      FROM "Ticket"
      ORDER BY year DESC
    `;

    return res.json({
      year,
      data: hourlyData,
      availableYears: availableYears.map((y) => y.year)
    });
  } catch (error) {
    console.error('Error fetching hourly by year:', error);
    return res.status(500).json({ error: 'Failed to fetch hourly data' });
  }
});

// Get dashboard analytics with detailed charts data (admin only)
router.get('/dashboard', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalTickets,
      openTickets,
      solvedTickets,
      totalUsers,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCountry,
      ticketsByChannel,
      ticketsByForm,
      ticketTrend,
      ticketsByAgent,
      ticketsByCategory,
      _avgResolutionTime,
      totalComments,
      hourlyDistribution,
      weekdayDistribution,
      fieldResponseStats
    ] = await Promise.all([
      // Total tickets
      prisma.ticket.count(),

      // Open tickets (NEW, OPEN, PENDING, ON_HOLD)
      prisma.ticket.count({
        where: { status: { in: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD'] } }
      }),

      // Solved tickets (SOLVED or CLOSED)
      prisma.ticket.count({ where: { status: { in: ['SOLVED', 'CLOSED'] } } }),

      // Total users
      prisma.user.count(),

      // Tickets by status
      prisma.ticket.groupBy({
        by: ['status'],
        _count: true
      }),

      // Tickets by priority
      prisma.ticket.groupBy({
        by: ['priority'],
        _count: true
      }),

      // Tickets by country
      prisma.ticket.groupBy({
        by: ['country'],
        _count: true,
        where: { country: { not: null } }
      }),

      // Tickets by channel
      prisma.ticket.groupBy({
        by: ['channel'],
        _count: true
      }),

      // Tickets by form
      prisma.ticket.groupBy({
        by: ['formId'],
        _count: true,
        where: { formId: { not: null } }
      }),

      // Ticket trend (last 30 days, grouped by day)
      // Uses a CTE to get both created and solved counts per day
      prisma.$queryRaw`
        WITH dates AS (
          SELECT generate_series(
            (NOW() - INTERVAL '30 days')::date,
            NOW()::date,
            '1 day'::interval
          )::date AS date
        ),
        created AS (
          SELECT DATE("createdAt") as date, COUNT(*) as count
          FROM "Ticket"
          WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE("createdAt")
        ),
        solved AS (
          SELECT DATE("solvedAt") as date, COUNT(*) as count
          FROM "Ticket"
          WHERE "solvedAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE("solvedAt")
        )
        SELECT
          d.date,
          COALESCE(c.count, 0) as count,
          COALESCE(s.count, 0) as solved
        FROM dates d
        LEFT JOIN created c ON d.date = c.date
        LEFT JOIN solved s ON d.date = s.date
        ORDER BY d.date ASC
      `,

      // Tickets by agent (assigned tickets)
      prisma.ticket.groupBy({
        by: ['assigneeId'],
        _count: true,
        where: { assigneeId: { not: null } }
      }),

      // Tickets by category
      prisma.ticket.groupBy({
        by: ['categoryId'],
        _count: true,
        where: { categoryId: { not: null } }
      }),

      // Average resolution time for solved tickets
      prisma.$queryRaw<Array<{ avg_hours: number }>>`
        SELECT
          AVG(EXTRACT(EPOCH FROM ("solvedAt" - "createdAt")) / 3600) as avg_hours
        FROM "Ticket"
        WHERE "solvedAt" IS NOT NULL
      `,

      // Total comments
      prisma.comment.count(),

      // Hourly distribution (when tickets are created)
      prisma.$queryRaw`
        SELECT
          EXTRACT(HOUR FROM "createdAt") as hour,
          COUNT(*) as count
        FROM "Ticket"
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour ASC
      `,

      // Weekday distribution
      prisma.$queryRaw`
        SELECT
          EXTRACT(DOW FROM "createdAt") as day,
          COUNT(*) as count
        FROM "Ticket"
        GROUP BY EXTRACT(DOW FROM "createdAt")
        ORDER BY day ASC
      `,

      // Field response statistics (how many times each field was filled)
      prisma.formResponse.groupBy({
        by: ['fieldId'],
        _count: true
      })
    ]);

    // Process status data
    const statusData = ticketsByStatus.map(item => ({
      name: item.status,
      value: item._count,
      label: item.status.replace('_', ' ')
    }));

    // Process priority data
    const priorityData = ticketsByPriority.map(item => ({
      name: item.priority,
      value: item._count,
      label: item.priority.charAt(0) + item.priority.slice(1).toLowerCase()
    }));

    // Process country data
    const countryData = await Promise.all(
      ticketsByCountry.map(async (item) => ({
        name: item.country || 'Unknown',
        value: item._count
      }))
    );

    // Sort and limit to top 10 countries
    const topCountries = countryData
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Process channel data
    const channelData = ticketsByChannel.map(item => ({
      name: item.channel,
      value: item._count
    }));

    // Process form data with names
    const formDataWithNames = await Promise.all(
      ticketsByForm.map(async (item) => {
        if (!item.formId) return null;
        const form = await prisma.form.findUnique({
          where: { id: item.formId },
          select: { name: true }
        });
        return {
          name: form?.name || 'Unknown Form',
          value: item._count
        };
      })
    );

    const formData = formDataWithNames
      .filter(Boolean)
      .sort((a, b) => b!.value - a!.value)
      .slice(0, 10);

    // Process agent data with names
    const agentDataWithNames = await Promise.all(
      ticketsByAgent.map(async (item) => {
        if (!item.assigneeId) return null;
        const agent = await prisma.user.findUnique({
          where: { id: item.assigneeId },
          select: { email: true, firstName: true, lastName: true }
        });
        const name = agent
          ? (agent.firstName || agent.lastName
            ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim()
            : agent.email)
          : 'Unknown';

        // Get solved tickets for this agent
        const solvedCount = await prisma.ticket.count({
          where: { assigneeId: item.assigneeId, status: 'SOLVED' }
        });

        return {
          name,
          total: item._count,
          solved: solvedCount,
          solveRate: item._count > 0 ? ((solvedCount / item._count) * 100).toFixed(1) : '0'
        };
      })
    );
    const agentData = agentDataWithNames.filter(Boolean).sort((a: any, b: any) => b.total - a.total);

    // Process category data with names
    const categoryDataWithNames = await Promise.all(
      ticketsByCategory.map(async (item) => {
        if (!item.categoryId) return null;
        const category = await prisma.category.findUnique({
          where: { id: item.categoryId },
          select: { name: true }
        });
        return {
          name: category?.name || 'Unknown Category',
          value: item._count
        };
      })
    );
    const categoryData = categoryDataWithNames.filter(Boolean);

    // Calculate average comments per ticket
    const avgCommentsPerTicket = totalTickets > 0 ? (totalComments / totalTickets).toFixed(1) : '0';

    // Process hourly distribution
    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const found = (hourlyDistribution as any[]).find((h: any) => parseInt(h.hour) === i);
      return {
        hour: i,
        count: found ? Number(found.count) : 0,
        label: `${i}:00`
      };
    });

    // Process weekday distribution
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayData = weekdayNames.map((name, i) => {
      const found = (weekdayDistribution as any[]).find((d: any) => parseInt(d.day) === i);
      return {
        name,
        value: found ? Number(found.count) : 0
      };
    });

    // Convert BigInt values in trend data to numbers
    const trendData = (ticketTrend as any[]).map((item: any) => ({
      date: item.date,
      count: Number(item.count),
      solved: Number(item.solved)
    }));

    // Process field response statistics with field names and usage counts
    const fieldDataWithNames = await Promise.all(
      fieldResponseStats.map(async (item) => {
        const field = await prisma.formFieldLibrary.findUnique({
          where: { id: item.fieldId },
          select: { label: true, fieldType: true }
        });
        return {
          name: field?.label || 'Unknown Field',
          fieldType: field?.fieldType || 'unknown',
          responseCount: item._count,
          value: item._count
        };
      })
    );
    const fieldUsageData = fieldDataWithNames
      .sort((a, b) => b.responseCount - a.responseCount)
      .slice(0, 15); // Top 15 most used fields

    // Calculate total form responses
    const totalFormResponses = fieldResponseStats.reduce((sum, item) => sum + item._count, 0);

    return res.json({
      overview: {
        totalTickets,
        openTickets,
        solvedTickets,
        totalUsers,
        solveRate: totalTickets > 0 ? ((solvedTickets / totalTickets) * 100).toFixed(1) : '0',
        totalComments,
        avgCommentsPerTicket,
        totalFormResponses
      },
      charts: {
        status: statusData,
        priority: priorityData,
        country: topCountries,
        channel: channelData,
        forms: formData,
        agents: agentData,
        categories: categoryData,
        hourly: hourlyData,
        weekday: weekdayData,
        fieldUsage: fieldUsageData
      },
      trend: trendData
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// Get historical backlog by status (daily for 30 days, weekly for 12 weeks)
// Now reads from BacklogSnapshot table for accurate historical data
router.get('/backlog-history', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (_req: AuthRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks = 84 days
    twelveWeeksAgo.setHours(0, 0, 0, 0);

    // Get daily snapshots for last 30 days
    const dailySnapshots = await prisma.backlogSnapshot.findMany({
      where: {
        date: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Get weekly snapshots for last 12 weeks (use end of week snapshots)
    const weeklySnapshots = await prisma.backlogSnapshot.findMany({
      where: {
        date: {
          gte: twelveWeeksAgo
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Process daily data
    const dailyData = dailySnapshots.map((snapshot) => ({
      date: snapshot.date,
      new: snapshot.newCount,
      open: snapshot.openCount,
      pending: snapshot.pendingCount,
      hold: snapshot.holdCount,
      total: snapshot.totalCount
    }));

    // Aggregate weekly data - group by week start (Monday)
    const weeklyMap = new Map<string, { weekStart: Date; new: number; open: number; pending: number; hold: number; total: number }>();

    for (const snapshot of weeklySnapshots as Array<{ date: Date; newCount: number; openCount: number; pendingCount: number; holdCount: number; totalCount: number }>) {
      const date = new Date(snapshot.date);
      // Get start of week (Monday) using UTC methods to avoid timezone issues
      const day = date.getUTCDay();
      const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
      const weekKey = weekStart.toISOString().split('T')[0];

      // Use the latest snapshot of each week
      weeklyMap.set(weekKey, {
        weekStart: new Date(weekKey + 'T00:00:00.000Z'),
        new: snapshot.newCount,
        open: snapshot.openCount,
        pending: snapshot.pendingCount,
        hold: snapshot.holdCount,
        total: snapshot.totalCount
      });
    }

    const weeklyData = Array.from(weeklyMap.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .slice(-12); // Last 12 weeks

    return res.json({
      daily: dailyData,
      weekly: weeklyData
    });
  } catch (error) {
    console.error('Error fetching backlog history:', error);
    return res.status(500).json({ error: 'Failed to fetch backlog history' });
  }
});

// Backfill historical backlog snapshots (admin only)
// This creates snapshots for the past X days based on current ticket data
router.post('/backfill-backlog', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const days = req.body.days || 90; // Default 90 days
    const results: Array<{ date: string; new: number; open: number; pending: number; hold: number; total: number }> = [];

    console.log(`[Backfill Backlog] Starting backfill for ${days} days`);

    for (let i = 0; i < days; i++) {
      // Use UTC date to avoid timezone issues
      const now = new Date();
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));

      // Count tickets that were in backlog status on this date
      // A ticket was in backlog if it was created before/on this date and not solved before this date
      const [newCount, openCount, pendingCount, holdCount] = await Promise.all([
        prisma.ticket.count({
          where: {
            status: 'NEW',
            createdAt: { lte: new Date(date.getTime() + 24 * 60 * 60 * 1000) }, // Created by end of this day
            OR: [
              { solvedAt: null },
              { solvedAt: { gt: date } }
            ]
          }
        }),
        prisma.ticket.count({
          where: {
            status: 'OPEN',
            createdAt: { lte: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
            OR: [
              { solvedAt: null },
              { solvedAt: { gt: date } }
            ]
          }
        }),
        prisma.ticket.count({
          where: {
            status: 'PENDING',
            createdAt: { lte: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
            OR: [
              { solvedAt: null },
              { solvedAt: { gt: date } }
            ]
          }
        }),
        prisma.ticket.count({
          where: {
            status: 'ON_HOLD',
            createdAt: { lte: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
            OR: [
              { solvedAt: null },
              { solvedAt: { gt: date } }
            ]
          }
        })
      ]);

      const totalCount = newCount + openCount + pendingCount + holdCount;

      // Upsert the snapshot
      await prisma.backlogSnapshot.upsert({
        where: { date },
        create: {
          date,
          newCount,
          openCount,
          pendingCount,
          holdCount,
          totalCount
        },
        update: {
          newCount,
          openCount,
          pendingCount,
          holdCount,
          totalCount
        }
      });

      results.push({
        date: date.toISOString().split('T')[0],
        new: newCount,
        open: openCount,
        pending: pendingCount,
        hold: holdCount,
        total: totalCount
      });
    }

    console.log(`[Backfill Backlog] Completed backfill for ${days} days`);

    return res.json({
      message: `Backfilled ${days} days of backlog snapshots`,
      snapshots: results.slice(0, 10) // Return first 10 as sample
    });
  } catch (error) {
    console.error('Error backfilling backlog history:', error);
    return res.status(500).json({ error: 'Failed to backfill backlog history' });
  }
});

// Import historical backlog data (admin only)
// Allows importing specific values from external sources like Zendesk
router.post('/import-backlog', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { snapshots } = req.body;

    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      return res.status(400).json({ error: 'snapshots array is required' });
    }

    console.log(`[Import Backlog] Importing ${snapshots.length} snapshots`);

    const results: Array<{ date: string; new: number; open: number; pending: number; hold: number; total: number; status: string }> = [];

    for (const snapshot of snapshots) {
      const { date, new: newCount, open: openCount, pending: pendingCount, hold: holdCount } = snapshot;

      if (!date) {
        results.push({ ...snapshot, status: 'skipped - no date' });
        continue;
      }

      // Parse date as UTC to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      const snapshotDate = new Date(Date.UTC(year, month - 1, day));

      const totalCount = (newCount || 0) + (openCount || 0) + (pendingCount || 0) + (holdCount || 0);

      await prisma.backlogSnapshot.upsert({
        where: { date: snapshotDate },
        create: {
          date: snapshotDate,
          newCount: newCount || 0,
          openCount: openCount || 0,
          pendingCount: pendingCount || 0,
          holdCount: holdCount || 0,
          totalCount
        },
        update: {
          newCount: newCount || 0,
          openCount: openCount || 0,
          pendingCount: pendingCount || 0,
          holdCount: holdCount || 0,
          totalCount
        }
      });

      results.push({
        date: snapshotDate.toISOString().split('T')[0],
        new: newCount || 0,
        open: openCount || 0,
        pending: pendingCount || 0,
        hold: holdCount || 0,
        total: totalCount,
        status: 'imported'
      });
    }

    console.log(`[Import Backlog] Successfully imported ${results.filter(r => r.status === 'imported').length} snapshots`);

    return res.json({
      message: `Imported ${results.filter(r => r.status === 'imported').length} backlog snapshots`,
      results
    });
  } catch (error) {
    console.error('Error importing backlog history:', error);
    return res.status(500).json({ error: 'Failed to import backlog history' });
  }
});

// Debug endpoint to investigate a specific ticket's country data issue
router.get('/debug-ticket/:ticketNumber', requireAuth, requireAgent, requireAgentPermission('agentCanAccessAnalytics'), async (req: AuthRequest, res: Response) => {
  try {
    const ticketNumber = parseInt(req.params.ticketNumber);

    // Get the ticket with requester info
    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            timezone: true,
            clerkId: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Look up ALL users with the same email as the requester
    const usersWithSameEmail = ticket.requester?.email
      ? await prisma.user.findMany({
          where: { email: ticket.requester.email },
          select: {
            id: true,
            email: true,
            timezone: true,
            clerkId: true
          }
        })
      : [];

    // Check if any user with this email has timezone
    const userWithTimezone = ticket.requester?.email
      ? await prisma.user.findFirst({
          where: {
            email: ticket.requester.email,
            timezone: { not: null }
          },
          select: {
            id: true,
            email: true,
            timezone: true,
            clerkId: true
          }
        })
      : null;

    // Map timezone to country if available
    const mappedCountry = userWithTimezone?.timezone
      ? getCountryFromTimezone(userWithTimezone.timezone)
      : null;

    return res.json({
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        country: ticket.country,
        requesterId: ticket.requesterId
      },
      requesterFromRelation: ticket.requester,
      allUsersWithSameEmail: usersWithSameEmail,
      userWithTimezone,
      mappedCountry,
      issue: ticket.country
        ? 'Ticket already has country set'
        : !ticket.requester?.email
        ? 'Ticket has no requester email'
        : !userWithTimezone
        ? 'No user with this email has timezone set'
        : !mappedCountry
        ? `Timezone "${userWithTimezone.timezone}" could not be mapped to a country`
        : 'Should be able to update country - run backfill again'
    });
  } catch (error) {
    console.error('Error debugging ticket:', error);
    return res.status(500).json({ error: 'Failed to debug ticket' });
  }
});

export default router;
