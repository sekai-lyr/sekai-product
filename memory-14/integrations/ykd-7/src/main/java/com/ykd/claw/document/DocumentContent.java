package com.ykd.claw.document;

import java.util.List;

/**
 * Structured document content model used for document generation.
 * AI generates JSON matching this structure, which is then rendered
 * into the target format (PDF, Word, Excel, etc.).
 */
public class DocumentContent {
    private String title;
    private String subtitle;
    private String author;
    private String date;
    private List<Section> sections;

    public DocumentContent() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSubtitle() { return subtitle; }
    public void setSubtitle(String subtitle) { this.subtitle = subtitle; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public List<Section> getSections() { return sections; }
    public void setSections(List<Section> sections) { this.sections = sections; }

    /**
     * A document section with heading, paragraphs, optional tables, and bullet lists.
     */
    public static class Section {
        private String heading;
        private List<String> paragraphs;
        private List<List<String>> tables;   // each inner list is a row
        private List<String> bullets;

        public Section() {}

        public Section(String heading, List<String> paragraphs) {
            this.heading = heading;
            this.paragraphs = paragraphs;
        }

        public String getHeading() { return heading; }
        public void setHeading(String heading) { this.heading = heading; }

        public List<String> getParagraphs() { return paragraphs; }
        public void setParagraphs(List<String> paragraphs) { this.paragraphs = paragraphs; }

        public List<List<String>> getTables() { return tables; }
        public void setTables(List<List<String>> tables) { this.tables = tables; }

        public List<String> getBullets() { return bullets; }
        public void setBullets(List<String> bullets) { this.bullets = bullets; }
    }
}
