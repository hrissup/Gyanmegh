<script>
  import { onMount, createEventDispatcher } from 'svelte';

  // NEW: Export a prop to determine the user's role
  export let role = 'student'; // 'student' or 'lecturer'

  let canvas;
  let ctx;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentColor = '#000000';
  let currentBrushSize = 3;
  
  const dispatch = createEventDispatcher();

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'
  ];

  const brushSizes = [1, 3, 5, 8, 12, 16];

  onMount(() => {
    ctx = canvas.getContext('2d');
    updateCanvasStyle();
  });

  function updateCanvasStyle() {
    if (!ctx) return;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

  function startDrawing(e) {
    if (role !== 'lecturer') return; // Only lecturers can draw
    
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function draw(e) {
    if (!isDrawing || role !== 'lecturer') return;
    
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    
    // Dispatch the drawing data for network synchronization
    dispatch('draw', {
      fromX: lastX,
      fromY: lastY,
      toX: currentX,
      toY: currentY,
      color: currentColor,
      brushSize: currentBrushSize
    });
    
    lastX = currentX;
    lastY = currentY;
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function changeColor(color) {
    currentColor = color;
    updateCanvasStyle();
  }

  function changeBrushSize(size) {
    currentBrushSize = size;
    updateCanvasStyle();
  }
  
  // NEW: Function to handle clearing the canvas
  function handleClear() {
    // Dispatch a 'clear' event for the parent to send over the network
    dispatch('clear');
    // Clear the canvas locally
    clearCanvas();
  }

  // NEW: Public function for the parent to call
  export function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  export function drawOnCanvas(data) {
    if (!ctx) return;
    
    // Save current context state
    const originalColor = ctx.strokeStyle;
    const originalWidth = ctx.lineWidth;
    
    // Apply received drawing settings
    ctx.strokeStyle = data.color || currentColor;
    ctx.lineWidth = data.brushSize || currentBrushSize;
    
    ctx.beginPath();
    ctx.moveTo(data.fromX, data.fromY);
    ctx.lineTo(data.toX, data.toY);
    ctx.stroke();
    
    // Restore original context state
    ctx.strokeStyle = originalColor;
    ctx.lineWidth = originalWidth;
  }

  // Export canvas reference for snapshot functionality
  export function getCanvas() {
    return canvas;
  }
</script>

<div class="whiteboard-container">
  {#if role === 'lecturer'}
    <div class="toolbar">
      <div class="tool-section">
        <h3 class="tool-title">Colors</h3>
        <div class="color-palette">
          {#each colors as color}
            <button 
              class="color-btn {currentColor === color ? 'active' : ''}"
              style="background-color: {color}"
              on:click={() => changeColor(color)}
              title="Select color"
            ></button>
          {/each}
        </div>
      </div>
      
      <div class="tool-section">
        <h3 class="tool-title">Brush Size</h3>
        <div class="brush-sizes">
          {#each brushSizes as size}
            <button 
              class="brush-btn {currentBrushSize === size ? 'active' : ''}"
              on:click={() => changeBrushSize(size)}
              title="Brush size: {size}px"
            >
              <div class="brush-preview" style="width: {size}px; height: {size}px;"></div>
            </button>
          {/each}
        </div>
      </div>
      
      <div class="tool-section">
        <button class="clear-btn" on:click={handleClear} title="Clear whiteboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          </svg>
          Clear
        </button>
      </div>
    </div>
  {/if}

  <div class="canvas-container">
    <canvas
      bind:this={canvas}
      width="800"
      height="600"
      on:mousedown={startDrawing}
      on:mousemove={draw}
      on:mouseup={stopDrawing}
      on:mouseleave={stopDrawing}
      class="whiteboard-canvas"
    >
    </canvas>
    
    {#if role === 'student'}
      <div class="student-notice">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <span>View-only mode - Only lecturers can draw</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .whiteboard-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .toolbar {
    display: flex;
    gap: 2rem;
    align-items: center;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .tool-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tool-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .color-palette {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .color-btn {
    width: 32px;
    height: 32px;
    border: 2px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .color-btn:hover {
    transform: scale(1.1);
    border-color: #9ca3af;
  }

  .color-btn.active {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .brush-sizes {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .brush-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 2px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .brush-btn:hover {
    border-color: #9ca3af;
    background: #f9fafb;
  }

  .brush-btn.active {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .brush-preview {
    background: #000;
    border-radius: 50%;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-btn:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  .canvas-container {
    position: relative;
    display: flex;
    justify-content: center;
  }

  .whiteboard-canvas {
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: crosshair;
    background-color: #fff;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    transition: border-color 0.2s ease;
  }

  .whiteboard-canvas:hover {
    border-color: #9ca3af;
  }

  .student-notice {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    pointer-events: none;
    opacity: 0.9;
  }

  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      gap: 1rem;
    }
    
    .tool-section {
      flex-direction: row;
      align-items: center;
      gap: 1rem;
    }
    
    .whiteboard-canvas {
      width: 100%;
      height: auto;
      max-width: 600px;
    }
  }
</style>