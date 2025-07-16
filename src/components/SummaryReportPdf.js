import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Helper: convert a standard Google Drive share/view URL into a direct file URL that react-pdf can fetch.
// This is best-effort – if the URL isn't a standard Drive "file/d/<ID>/view" style link we simply return the original.
const gDriveToDirectUrl = (url) => {
  try {
    const match = url.match(/\/d\/(.+?)\//);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  } catch (e) {
    // Ignore errors – fallback to raw URL
  }
  return url;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  tocItem: {
    marginBottom: 4,
    color: "#0369a1",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  smallHeader: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
  },
  description: {
    marginBottom: 6,
    fontSize: 11,
  },
  techList: {
    marginBottom: 6,
    fontSize: 10,
  },
  link: {
    color: "#0369a1",
    fontSize: 10,
    marginBottom: 2,
  },
  image: {
    marginVertical: 6,
    // Let react-pdf calculate natural size; reduces chance of style errors
  },
});

export const SummaryReportPdf = ({ achievements }) => {
  console.log("SummaryReportPdf received achievements:", achievements);

  // Filter and validate achievements data to prevent undefined errors
  const validAchievements =
    achievements?.filter((a) => a && a.slug && a.title) || [];
  console.log("Valid achievements:", validAchievements.length);

  // Create a minimal test document first
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          Summary Report of Batikan's Achievements
        </Text>
        <Text style={styles.subtitle}>
          Check the achievement map on batikanor.com for more details.
        </Text>
        <Text>Found {validAchievements.length} achievements</Text>

        {/* Simple list without complex components first */}
        {validAchievements.slice(0, 3).map((a, i) => (
          <View key={a.slug} style={{ marginBottom: 10 }}>
            <Text style={styles.sectionHeader}>
              {i + 1}. {a.title}
            </Text>
            {a.date && <Text style={styles.smallHeader}>Date: {a.date}</Text>}
            {a.shortDescription && (
              <Text style={styles.description}>{a.shortDescription}</Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};
