import React from "react";

function TranscriptionEditor({ transcription, setTranscription, language, onGenerateSummary }){

const copyText = ()=>{
navigator.clipboard.writeText(transcription);
alert("Transcript copied to clipboard");
};

const clearText = ()=>{
if (window.confirm("Are you sure you want to clear the transcription?")) {
setTranscription("");
}
};

return(

<div className="transcription-editor-panel">

<div className="transcription-header-main">
<div className="header-left">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
<polyline points="14 2 14 8 20 8"></polyline>
<line x1="16" y1="13" x2="8" y2="13"></line>
<line x1="16" y1="17" x2="8" y2="17"></line>
<line x1="10" y1="9" x2="8" y2="9"></line>
</svg>
<h3>Consultation Transcript</h3>
</div>
<span className="language-badge-main">{language.toUpperCase()}</span>
</div>

<p className="transcription-info-main">
Review and edit the transcription below. The AI will extract medical information from this text.
</p>

<textarea
value={transcription}
onChange={(e)=>setTranscription(e.target.value)}
className="transcription-textarea-main"
placeholder="Transcription will appear here after recording... You can also type or edit manually."
/>

<div className="transcription-actions-main">

<button className="btn-icon" onClick={copyText} disabled={!transcription} title="Copy to clipboard">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>
Copy
</button>

<button className="btn-icon btn-danger" onClick={clearText} disabled={!transcription} title="Clear transcription">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="3 6 5 6 21 6"></polyline>
<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
</svg>
Clear
</button>

<button 
className="btn-generate-summary" 
onClick={onGenerateSummary} 
disabled={!transcription}
title="Generate AI summary"
>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M12 2L2 7l10 5 10-5-10-5z"></path>
<path d="M2 17l10 5 10-5"></path>
<path d="M2 12l10 5 10-5"></path>
</svg>
Generate AI Summary
</button>

</div>

</div>

);

}

export default TranscriptionEditor;
