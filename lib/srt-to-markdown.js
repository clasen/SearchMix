import fs from "node:fs";
import { readFileWithEncoding } from "./encoding-utils.js";

/**
 * Converts an SRT timestamp (HH:MM:SS,mmm) to seconds
 * @param {string} timestamp - Timestamp in SRT format
 * @returns {number} - Time in seconds
 */
function timestampToSeconds(timestamp) {
  const [time, ms] = timestamp.split(",");
  const [hours, minutes, seconds] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds + parseInt(ms) / 1000;
}

/**
 * Converts seconds to readable format (HH:MM:SS or MM:SS)
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Converts common HTML tags in SRT to Markdown format
 * @param {string} text - Text with HTML tags
 * @returns {string} - Text with Markdown format
 */
function htmlToMarkdown(text) {
  if (!text) return text;

  let result = text;

  // Convert italics: <i>text</i> → *text*
  result = result.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  
  // Convert bold: <b>text</b> → **text**
  result = result.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  
  // Convert underline: <u>text</u> → _text_ (using emphasis)
  result = result.replace(/<u>(.*?)<\/u>/gi, "_$1_");
  
  // Convert strong: <strong>text</strong> → **text**
  result = result.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  
  // Convert em: <em>text</em> → *text*
  result = result.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  
  // Remove font tags (usually only change color/size)
  result = result.replace(/<\/?font[^>]*>/gi, "");
  
  // Convert <br> and <br/> to line breaks
  result = result.replace(/<br\s*\/?>/gi, "\n");
  
  // Remove other unsupported HTML tags
  result = result.replace(/<\/?[^>]+(>|$)/g, "");

  return result.trim();
}

/**
 * Parses an SRT file and returns an array of subtitles
 * @param {string} srtContent - SRT file content
 * @returns {Array} - Array of subtitle objects
 */
function parseSRT(srtContent) {
  const subtitles = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );

    if (!timeMatch) continue;

    const startTime = timestampToSeconds(timeMatch[1]);
    const endTime = timestampToSeconds(timeMatch[2]);
    const rawText = lines.slice(2).join("\n").trim();
    const text = htmlToMarkdown(rawText);

    subtitles.push({
      index,
      startTime,
      endTime,
      text,
      timestamp: timeMatch[1],
    });
  }

  return subtitles;
}

/**
 * Groups subtitles into scenes based on time gaps
 * @param {Array} subtitles - Array of subtitles
 * @param {number} sceneGap - Seconds of pause to consider a new scene
 * @returns {Array} - Array of scenes
 */
function groupIntoScenes(subtitles, sceneGap = 5) {
  if (subtitles.length === 0) return [];

  const scenes = [];
  let currentScene = {
    startTime: subtitles[0].startTime,
    endTime: subtitles[0].endTime,
    subtitles: [subtitles[0]],
  };

  for (let i = 1; i < subtitles.length; i++) {
    const prev = subtitles[i - 1];
    const current = subtitles[i];
    const gap = current.startTime - prev.endTime;

    // If there's a significant pause, start a new scene
    if (gap > sceneGap) {
      scenes.push(currentScene);
      currentScene = {
        startTime: current.startTime,
        endTime: current.endTime,
        subtitles: [current],
      };
    } else {
      // Continue in the same scene
      currentScene.endTime = current.endTime;
      currentScene.subtitles.push(current);
    }
  }

  // Add the last scene
  scenes.push(currentScene);
  return scenes;
}

/**
 * Groups consecutive subtitles from the same speaker into dialogues
 * @param {Array} subtitles - Array of subtitles
 * @returns {Array} - Array of grouped dialogues
 */
function groupDialogues(subtitles) {
  if (subtitles.length === 0) return [];

  const dialogues = [];
  let currentDialogue = {
    text: subtitles[0].text,
    startTime: subtitles[0].startTime,
    endTime: subtitles[0].endTime,
    lines: [subtitles[0].text],
  };

  for (let i = 1; i < subtitles.length; i++) {
    const prev = subtitles[i - 1];
    const current = subtitles[i];
    const gap = current.startTime - prev.endTime;

    // Group if the pause is short (less than 2 seconds)
    if (gap < 2) {
      currentDialogue.text += " " + current.text;
      currentDialogue.endTime = current.endTime;
      currentDialogue.lines.push(current.text);
    } else {
      // New dialogue
      dialogues.push(currentDialogue);
      currentDialogue = {
        text: current.text,
        startTime: current.startTime,
        endTime: current.endTime,
        lines: [current.text],
      };
    }
  }

  // Add the last dialogue
  dialogues.push(currentDialogue);
  return dialogues;
}

/**
 * Converts scenes to Markdown format
 * @param {Array} scenes - Array of scenes
 * @param {number} totalDuration - Total duration of the content in seconds
 * @param {Object} options - Conversion options
 * @returns {string} - Markdown content
 */
function scenesToMarkdown(scenes, totalDuration, options = {}) {
  const {
    includeTimestamps = true,
    groupDialogues: shouldGroupDialogues = true,
    title = null,
    metadata = {},
  } = options;

  let markdown = "";

  // Add YAML front matter if there's metadata
  const hasMetadata = title || Object.keys(metadata).length > 0;
  if (hasMetadata) {
    const frontMatter = ["---"];
    if (title) {
      frontMatter.push(`title: "${title}"`);
    }
    if (metadata.type) {
      frontMatter.push(`type: ${metadata.type}`);
    }
    if (metadata.duration) {
      frontMatter.push(`duration: "${formatTime(metadata.duration)}"`);
    }
    if (metadata.scenes) {
      frontMatter.push(`scenes: ${metadata.scenes}`);
    }
    if (metadata.language) {
      frontMatter.push(`language: ${metadata.language}`);
    }
    // Add any additional metadata fields
    for (const [key, value] of Object.entries(metadata)) {
      if (!["type", "duration", "scenes", "language"].includes(key)) {
        frontMatter.push(`${key}: ${typeof value === "string" ? `"${value}"` : value}`);
      }
    }
    frontMatter.push("---");
    markdown += frontMatter.join("\n") + "\n\n";
  }

  scenes.forEach((scene, index) => {
    const sceneNumber = index + 1;
    const startFormatted = formatTime(scene.startTime);
    const endFormatted = formatTime(scene.endTime);
    const duration = Math.round(scene.endTime - scene.startTime);
    const percentage = Math.round((scene.startTime / totalDuration) * 100);

    // Scene title with number, time range, duration, and percentage
    const sceneTitle = `# ${sceneNumber} | ${startFormatted} → ${endFormatted} | ${duration}s | ${percentage}%`;

    markdown += `${sceneTitle}\n\n`;

    // Process dialogues
    if (shouldGroupDialogues) {
      const dialogues = groupDialogues(scene.subtitles);
      dialogues.forEach((dialogue) => {
        const time = formatTime(dialogue.startTime);
        markdown += `## ${time}\n\n${dialogue.text}\n\n`;
      });
    } else {
      // Show each subtitle individually
      scene.subtitles.forEach((subtitle) => {
        const time = formatTime(subtitle.startTime);
        markdown += `## ${time}\n\n${subtitle.text}\n\n`;
      });
    }

    markdown += "---\n\n";
  });

  return markdown;
}

/**
 * Converts an SRT file to Markdown
 * @param {string} srtPath - Path to the SRT file
 * @param {Object} options - Conversion options
 * @returns {Promise<string>} - Markdown content
 */
export async function srtToMarkdown(srtPath, options = {}) {
  try {
    const srtContent = readFileWithEncoding(srtPath);
    const subtitles = parseSRT(srtContent);

    if (subtitles.length === 0) {
      throw new Error("No valid subtitles found in the file");
    }

    const totalDuration = subtitles[subtitles.length - 1].endTime;
    const sceneGap = options.sceneGap || 10;
    const scenes = groupIntoScenes(subtitles, sceneGap);
    
    // Prepare metadata
    const metadata = {
      type: "subtitle",
      duration: totalDuration,
      scenes: scenes.length,
      ...(options.metadata || {}),
    };

    const markdown = scenesToMarkdown(scenes, totalDuration, {
      ...options,
      metadata,
    });

    return markdown;
  } catch (error) {
    throw new Error(`Error converting SRT: ${error.message}`);
  }
}

/**
 * Gets statistics from an SRT file
 * @param {string} srtPath - Path to the SRT file
 * @returns {Object} - File statistics
 */
export function getSRTStats(srtPath) {
  const srtContent = readFileWithEncoding(srtPath);
  const subtitles = parseSRT(srtContent);

  if (subtitles.length === 0) {
    return {
      subtitles: 0,
      duration: 0,
      scenes: 0,
    };
  }

  const duration = subtitles[subtitles.length - 1].endTime;
  const scenes = groupIntoScenes(subtitles, 5);

  return {
    subtitles: subtitles.length,
    duration: Math.round(duration),
    durationFormatted: formatTime(duration),
    scenes: scenes.length,
    averageSubtitlesPerScene: (subtitles.length / scenes.length).toFixed(1),
  };
}
