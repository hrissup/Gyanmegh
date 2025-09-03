<script>
  import { onMount } from 'svelte';
  
  let notes = [];
  let selectedNote = null;
  let isViewing = false;

  onMount(() => {
    loadNotes();
  });

  function loadNotes() {
    try {
      const savedNotes = JSON.parse(localStorage.getItem('whiteboard-notes') || '[]');
      notes = savedNotes.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error('Error loading notes:', error);
      notes = [];
    }
  }

  function viewNote(note) {
    selectedNote = note;
    isViewing = true;
  }

  function closeViewer() {
    isViewing = false;
    selectedNote = null;
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        const savedNotes = JSON.parse(localStorage.getItem('whiteboard-notes') || '[]');
        const filteredNotes = savedNotes.filter(note => note.id !== noteId);
        localStorage.setItem('whiteboard-notes', JSON.stringify(filteredNotes));
        loadNotes();
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  }
</script>

<div class="notes-viewer">
  <div class="viewer-header">
    <h3 class="viewer-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      Whiteboard Notes
    </h3>
  </div>

  {#if notes.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      <p>No whiteboard notes yet</p>
      <span>Notes will appear here after recording lectures</span>
    </div>
  {:else}
    <div class="notes-list">
      {#each notes as note}
        <div class="note-item">
          <div class="note-info">
            <h4 class="note-title">{note.title}</h4>
            <p class="note-meta">
              {formatDate(note.date)} • {formatDuration(note.duration)} • {note.totalSnapshots} snapshots
            </p>
          </div>
          <div class="note-actions">
            <button class="view-btn" on:click={() => viewNote(note)} title="View notes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="delete-btn" on:click={() => deleteNote(note.id)} title="Delete note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if isViewing && selectedNote}
  <div class="modal-overlay" on:click={closeViewer}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>{selectedNote.title}</h3>
        <button class="close-btn" on:click={closeViewer}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="note-details">
          <p><strong>Date:</strong> {formatDate(selectedNote.date)}</p>
          <p><strong>Duration:</strong> {formatDuration(selectedNote.duration)}</p>
          <p><strong>Snapshots:</strong> {selectedNote.totalSnapshots}</p>
        </div>
        <div class="snapshots-grid">
          {#each selectedNote.snapshots as snapshot, index}
            <div class="snapshot-item">
              <div class="snapshot-time">
                Snapshot {index + 1} - {formatDuration(Math.floor(snapshot.timestamp / 1000))}
              </div>
              <img src={snapshot.dataUrl} alt="Whiteboard snapshot" />
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .notes-viewer {
    background: white;
    border-radius: 8px;
    padding: 1rem;
  }

  .viewer-header {
    margin-bottom: 1rem;
  }

  .viewer-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .viewer-title svg {
    width: 1.25rem;
    height: 1.25rem;
    color: #667eea;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

  .empty-state svg {
    width: 3rem;
    height: 3rem;
    margin: 0 auto 1rem;
    color: #d1d5db;
  }

  .empty-state p {
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .empty-state span {
    font-size: 0.875rem;
  }

  .notes-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .note-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .note-info {
    flex: 1;
  }

  .note-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.25rem 0;
  }

  .note-meta {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  .note-actions {
    display: flex;
    gap: 0.5rem;
  }

  .view-btn, .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-btn {
    background: #667eea;
    color: white;
  }

  .view-btn:hover {
    background: #5a67d8;
  }

  .delete-btn {
    background: #ef4444;
    color: white;
  }

  .delete-btn:hover {
    background: #dc2626;
  }

  .view-btn svg, .delete-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: #f3f4f6;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: #e5e7eb;
  }

  .close-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .note-details {
    background: #f8fafc;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .note-details p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
  }

  .snapshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .snapshot-item {
    text-align: center;
  }

  .snapshot-time {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .snapshot-item img {
    max-width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    .modal-content {
      margin: 1rem;
      max-width: calc(100vw - 2rem);
    }
    
    .snapshots-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

