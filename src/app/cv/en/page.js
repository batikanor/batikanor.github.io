// src/app/cv/en/page.js
export default function CvRedirect() {
    if (typeof window !== 'undefined') {
        window.location.href = 'https://docs.google.com/document/d/1ZVQcdNvOR46HBUCtVy6XKFOXocRYL9-TR_LLrRfJ2T8/export?format=pdf';
    }

    return (
        <div>
            <p>Downloading batikan's most up-to-date cv...</p>
            <p>If download hasn't started, <a href="https://docs.google.com/document/d/1ZVQcdNvOR46HBUCtVy6XKFOXocRYL9-TR_LLrRfJ2T8/export?format=pdf">click here</a>.</p>
        </div>
    );
}
