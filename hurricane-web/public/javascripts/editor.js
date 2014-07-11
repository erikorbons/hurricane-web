// TODO: implement home and end
// TODO: fix for positioning cursor at the start of a line
// TODO: implement left/right navigation between text nodes.
jQuery(document).ready (function () {
	console.log ('Ready!');
	
	var body = $('body'),
		selection = $('.hc-selection:first'),
		cursor = $('.hc-cursor:first'),
		textarea = $('.hc-textarea:first'),
		selectionNodes = [ ],
		rangeStart = null,
		rangeEnd = null,
		currentRange = null;

	var blockElements = {
		'p': 1,
		'li': 1,
		'ul': 1
	};
	var inlineElements = {
		'span': 1,
		'em': 1,
		'strong': 1,
		'a': 1
	};
	
	function getBoundingClientRect (range) {
		var rects = range.getClientRects ();
		if (rects.length == 0) {
			return {
				left: 0,
				right: 0,
				top: 0,
				bottom: 0
			};
		}
		
		var result = {
			left: rects[0].left,
			right: rects[0].right,
			top: rects[0].top,
			bottom: rects[0].bottom
		};
		
		for (var i = 1; i < rects.length; ++ i) {
			var r  = rects[i];
			
			if (r.left < result.left) {
				result.left = r.left;
			}
			if (r.right > result.right) {
				result.right = r.right;
			}
			if (r.top < result.top) {
				result.top = r.top;
			}
			if (r.bottom > result.bottom) {
				result.bottom = r.bottom;
			}
		}
		
		return result;
	}
	
	function updateCursor () {
		if (currentRange.collapsed) {
			var rect = getBoundingClientRect (currentRange);
			console.log ('Cursor rect: ', rect, currentRange.getClientRects ());
			cursor.css ({
				display: 'block',
				left: rect.left + 'px',
				top: rect.top + 'px',
				height: (rect.bottom - rect.top) + 'px'
			});
		} else {
			cursor.css ('display', 'none');
		}
	}
	
	function updateTextarea () {
		var rect = getBoundingClientRect (currentRange);
		
		// Move the textarea over the selection:
		textarea.css ({
			display: 'block',
			left: (rect.left - 5) + 'px',
			top: (rect.top - 5) + 'px',
			width: ((rect.right - rect.left) + 10) + 'px',
			height: ((rect.bottom - rect.top) + 10)+ 'px'
		});
		
		// Set the text content:
		textarea.val (currentRange.toString ());
		
		// Select all text in the textarea and give it the focus:
		textarea.select ();
		textarea.focus ();
	}

	function rangeFromPoint (x, y) {
		if (document.caretPositionFromPoint) {
			var pos = document.caretPositionFromPoint (x, y),
				range = document.createRange ();
			
			range.setStart (pos.offsetNode, pos.offset);
			range.setEnd (pos.offsetNode, pos.offset);
			
			return range;
		} else if (document.caretRangeFromPoint) {
			return document.caretRangeFromPoint (x, y);
		}
	}
	
	function rangeIn (rangeA, rangeB) {
		return rangeA.compareBoundaryPoints (Range.START_TO_START, rangeB) >= 0
			&& rangeA.compareBoundaryPoints (Range.START_TO_END, rangeB) <= 0;
	}
	
	/**
	 * Updates range start and end if needed (to have the range skip over uneditable content
	 * for example) and update the selection or cursor (depending on the size of the range).
	 */
	function updateSelectionRange () {
		var range = document.createRange ();
		
		if (rangeStart.compareBoundaryPoints (Range.START_TO_START, rangeEnd) < 0) {
			range.setStart (rangeStart.startContainer, rangeStart.startOffset);
			range.setEnd (rangeEnd.startContainer, rangeEnd.startOffset);
		} else {
			range.setStart (rangeEnd.startContainer, rangeEnd.startOffset);
			range.setEnd (rangeStart.startContainer, rangeStart.startOffset);
		}
		
		var rects = range.getClientRects ();

		for (var i = 0; i < rects.length; ++ i) {
			var rect = rects[i];
			
			if (selectionNodes[i]) {
				sel = selectionNodes[i];
			} else {
				sel = $('<div></div>');
				sel.css ({
					position: 'absolute',
					backgroundColor: 'red'
				});
				selection.append (sel);
				selectionNodes[i] = sel;
			}

			sel.css ({
				display: 'block',
				
				left: rect.left + 'px',
				width: (rect.right - rect.left) + 'px',
				top: rect.top + 'px',
				height: (rect.bottom - rect.top) + 'px'
			});
		}
		
		for (; i < selectionNodes.length; ++ i) {
			selectionNodes[i].css ('display', 'none');
		}
		
		currentRange = range;
	}
	
	/**
	 * Updates the selection during a drag operation.
	 */
	function updateSelection (startX, startY, endX, endY) {
		rangeStart = rangeFromPoint (startX, startY),
		rangeEnd = rangeFromPoint (endX, endY);
		
		updateSelectionRange ();
	}
	
	/**
	 * Returns the first text node in the given container.
	 */
	function getFirstTextNode (container) {
		var node = container;
		
		while (node && node.nodeType != Node.TEXT_NODE) {
			if (node.nodeType == Node.ELEMENT_NODE) {
				node = node.firstChild;
			} else {
				node = node.nextSibling;
			}
		}
		
		return node;
	}
	
	/**
	 * Returns the last text node in the given container.
	 */
	function getLastTextNode (container) {
		var node = container;
		
		while (node && node.nodeType != Node.TEXT_NODE) {
			if (node.nodeType == Node.ELEMENT_NODE) {
				node = node.lastChild;
			} else {
				node = node.previousSibling;
			}
		}
		
		return node;
	}
	
	/**
	 * Returns the first block level element directly below the given element. The
	 * block is at the same level in the dom tree, or at a higher level.
	 */
	function nextBlock (container) {
		var block = container;
		
		while (block && block.localName.toLowerCase () in blockElements) {
			if (block.nextElementSibling) {
				var nextBlock = block.nextElementSibling;
				while (nextBlock.firstElementChild && nextBlock.firstElementChild.localName.toLowerCase () in blockElements) {
					nextBlock = nextBlock.firstElementChild;
				}
				return nextBlock;
			}
			
			block = block.parentNode;
		}
		
		return null;
	}
	
	/**
	 * Returns the first block level element directly above the given element. The
	 * block is at the same level in the dom tree, or at a higher level.
	 */
	function previousBlock (container) {
		var block = container;
		
		while (block && block.localName.toLowerCase () in blockElements) {
			if (block.previousElementSibling) {
				var previousBlock = block.previousElementSibling;
				while (previousBlock.lastElementChild && previousBlock.lastElementChild.localName.toLowerCase () in blockElements) {
					previousBlock = previousBlock.lastElementChild;
				}
				return previousBlock;
			}
			
			block = block.parentNode;
		}
		
		return null;
	}
	
	/**
	 * Searches the given list of rects for a rect that is directly above the
	 * rect given in the second argument. Returns null if there is no rect
	 * directly above. If multiple rects are above the given rect, return the closest one.
	 * 
	 * Returns the index of the rect.
	 */
	function findRectAbove (rects, rect) {
		return _findRect (rects, rect, false);
	}
	
	/**
	 * Searches the given list of rects for a rect that is directly below the
	 * rect given in the second argument. Returns null if there is no rect
	 * directly above. If multiple rects are below the given rect, return the closest one.
	 * 
	 * Returns the index of the rect.
	 */
	function findRectBelow (rects, rect) {
		return _findRect (rects, rect, true);
	}
	
	function _findRect (rects, rect, below) {
		var candidates = [ ];
		
		// Locate all rects that are below the given rect and not below the first
		// candidate (if any). This assumes that the rects are in proper order.
		if (below) {
			for (var i = 0; i < rects.length; ++ i) {
				if (candidates.length > 0 && rects[i].top >= rects[candidates[0]].bottom) {
					continue;
				} else if (rects[i].top >= rect.bottom) {
					candidates.push (i);
				}
			}
		} else {
			for (var i = rects.length - 1; i >= 0; -- i) {
				if (candidates.length > 0 && rects[i].bottom <= rects[candidates[0]].top) {
					continue;
				} else if (rects[i].bottom <= rect.top) {
					candidates.push (i);
				}
			}
		}
		
		if (candidates.length == 0) {
			return null;
		}
		
		// Select the candidate that is below the reference rect, or the closest one to the left:
		var selectedCandidate = candidates[0];
		for (var i = 0; i < candidates.length; ++ i) {
			if (rects[candidates[i]].left > rect.right) {
				break;
			}
			selectedCandidate = candidates[i];
		}
		
		return selectedCandidate;
	}
	
	/**
	 * Returns a list of rects that make up the inline (text) content of the given
	 * block.
	 */
	function getBlockRects (blockElement) {
		var firstTextNode = getFirstTextNode (blockElement),
			lastTextNode = getLastTextNode (blockElement),
			blockRange = document.createRange ();
		
		console.log ('Text nodes: ', firstTextNode.wholeText.length, lastTextNode.wholeText.length);
		
		blockRange.setStart (firstTextNode, 0);
		blockRange.setEnd (lastTextNode, lastTextNode.wholeText.length);
		
		return blockRange.getClientRects ();
	}
	
	/**
	 * Returns an adjacent text node to the given node, or null if there is no node.
	 */
	function getAdjacentTextNode (node, direction) {
		var adjacentSibling = direction == 'left' ? 'previousSibling' : 'nextSibling';
		
		
	}
	
	/**
	 * Perform navigation by moving the end point of the range in the given direction.
	 * If moveStart is true, the start point of the current range is moved to the same
	 * position as the end point (normal cursor navigation).
	 * 
	 * Accepted directions: up, down, left, right, home, end
	 */
	function navigate (direction, moveStart) {
		console.log ('Navigate: ', direction, moveStart);
		
		var container = rangeEnd.endContainer,
			currentOffset = rangeEnd.endOffset;
		
		// Hide the textarea:
		textarea.css ('display', 'none');
		
		// Easy special cases, handle left and right within the current text node:
		if (direction == 'left' && container.nodeType == Node.TEXT_NODE && currentOffset > 0) {
			console.log ('Left within current text node');
			rangeEnd.setStart (container, currentOffset - 1);
			rangeEnd.setEnd (container, currentOffset - 1);
			if (moveStart) {
				rangeStart.setStart (container, currentOffset - 1);
				rangeStart.setEnd (container, currentOffset - 1);
			}
			updateSelectionRange ();
			updateTextarea ();
			updateCursor ();
			return;
		} else if (direction == 'right' && container.nodeType == Node.TEXT_NODE && currentOffset < container.wholeText.length) {
			console.log ('Right within current text node');
			rangeEnd.setEnd (container, currentOffset + 1);
			rangeEnd.setStart (container, currentOffset + 1);
			if (moveStart) {
				rangeStart.setEnd (container, currentOffset + 1);
				rangeStart.setStart (container, currentOffset + 1);
			}
			updateSelectionRange ();
			updateTextarea ();
			updateCursor ();
			return;
		}
		
		// Locate the containing block:
		var blockElement = rangeEnd.endContainer;
		
		while (!blockElement.localName || !(blockElement.localName.toLowerCase () in blockElements)) {
			blockElement = blockElement.parentNode;
		}
		console.log ('Containing block: ', blockElement);
		
		// Get the rects that make up all text in the current block:
		var rects = getBlockRects (blockElement),
			endRect = getBoundingClientRect (rangeEnd);
		
		console.log ('Rects: ', rects, endRect);
		
		// Handle home and end:
		if (direction == 'home') {
			console.log ('home on current line');
			rangeEnd = rangeFromPoint (rects[currentRect].left, rects[currentRect].top + ((rects[currentRect].bottom - rects[currentRect].bottom) / 2));
			if (moveStart) {
				rangeStart = rangeFromPoint (rects[currentRect].left, rects[currentRect].top + ((rects[currentRect].bottom - rects[currentRect].bottom) / 2));
			}
			updateSelectionRange ();
			updateTextarea ();
			updateCursor ();
			return;
		} else if (direction == 'end') {
			console.log ('end on current line');
			rangeEnd = rangeFromPoint (rects[currentRect].right, rects[currentRect].top + ((rects[currentRect].bottom - rects[currentRect].bottom) / 2));
			if (moveStart) {
				rangeStart = rangeFromPoint (rects[currentRect].right, rects[currentRect].top + ((rects[currentRect].bottom - rects[currentRect].bottom) / 2));
			}
			updateSelectionRange ();
			updateTextarea ();
			updateCursor ();
			return;
		}
		
		// Handle up and down within the same block:
		if (direction == 'up') {
			console.log ('Up within the same block');
			var index = findRectAbove (rects, endRect);
			if (index !== null) {
				rangeEnd = rangeFromPoint (endRect.left, rects[index].top + ((rects[index].bottom - rects[index].bottom) / 2));
				if (moveStart) {
					rangeStart = rangeFromPoint (endRect.left, rects[index].top + ((rects[index].bottom - rects[index].bottom) / 2));
				}
				updateSelectionRange ();
				updateTextarea ();
				updateCursor ();
				return;
			}
		} else if (direction == 'down') {
			console.log ('Down within the same block');
			var index = findRectBelow (rects, endRect);
			if (index !== null) {
				rangeEnd = rangeFromPoint (endRect.left, rects[index].top + ((rects[index].bottom - rects[index].bottom) / 2));
				if (moveStart) {
					rangeStart = rangeFromPoint (endRect.left, rects[index].top + ((rects[index].bottom - rects[index].bottom) / 2));
				}
				console.log (rangeStart, rangeEnd);
				updateSelectionRange ();
				updateTextarea ();
				updateCursor ();
				return;
			}
		}
		
		// Handle up and down between blocks:
		var adjacentBlock = direction == 'up' ? previousBlock (blockElement) : nextBlock (blockElement);
		if (!adjacentBlock) {
			console.log ('No adjacent block');
			updateSelectionRange ();
			updateTextarea ();
			updateCursor ();
			return;
		}
		
		var adjacentRects = getBlockRects (adjacentBlock);
		console.log ('Adjacent block: ', adjacentBlock);
		
		if (direction == 'up') {
			var index = findRectAbove (adjacentRects, endRect);
			if (index !== null) {
				rangeEnd = rangeFromPoint (endRect.left, adjacentRects[index].top + ((adjacentRects[index].bottom - adjacentRects[index].bottom) / 2));
				if (moveStart) {
					rangeStart = rangeFromPoint (endRect.left, adjacentRects[index].top + ((adjacentRects[index].bottom - adjacentRects[index].bottom) / 2));
				}
				console.log (rangeStart, rangeEnd);
				updateSelectionRange ();
				updateTextarea ();
				updateCursor ();
				return;
			}
		} else if (direction == 'down') {
			var index = findRectBelow (adjacentRects, endRect);
			if (index !== null) {
				rangeEnd = rangeFromPoint (endRect.left, adjacentRects[index].top + ((adjacentRects[index].bottom - adjacentRects[index].bottom) / 2));
				if (moveStart) {
					rangeStart = rangeFromPoint (endRect.left, adjacentRects[index].top + ((adjacentRects[index].bottom - adjacentRects[index].bottom) / 2));
				}
				console.log (rangeStart, rangeEnd);
				updateSelectionRange ();
				updateTextarea ();
				updateCursor ();
				return;
			}
		}
		
		updateSelectionRange ();
		updateTextarea ();
		updateCursor ();
	}
	
	$('.hc-editor').mousedown (function (e) {
		var startX = e.pageX;
		var startY = e.pageY;
		
		// Only LMB:
		if (e.which == 3) {
			var range = rangeFromPoint (startX, startY);
			if (!currentRange || !rangeIn (range, currentRange)) {
				updateSelection (startX, startY, startX, startY);
				updateCursor ();
				updateTextarea ();
			}
			return;
		} else if (e.which != 1) {
			return;
		}
		
		e.preventDefault ();
		e.stopPropagation ();
	
		// Hide the textarea:
		textarea.css ('display', 'none');
		
		// Reset the selection and move the textarea:
		updateSelection (startX, startY, startX, startY);
		
		body.mousemove (function (e) {
			e.preventDefault ();
			e.stopPropagation ();
			
			updateSelection (startX, startY, e.pageX, e.pageY);
			updateCursor ();
		});
		
		body.mouseup (function (e) {
			e.preventDefault ();
			e.stopPropagation ();
			
			updateSelection (startX, startY, e.pageX, e.pageY);
			updateCursor ();
			updateTextarea ();
			
			body
				.off ('mousemove')
				.off ('mouseup');
		});
	});
	
	// Handle navigation events:
	textarea.keydown (function (e) {
		var direction;
		
		// Determine navigation direction:
		switch (e.which) {
		case 35:	// Home
			direction = 'end';
			break;
		case 36:	// End
			direction = 'home';
			break;
		case 37:	// Left
			direction = 'left';
			break;
		case 38:	// Up
			direction = 'up';
			break;
		case 39:	// Right
			direction = 'right';
			break;
		case 40:	// Down
			direction = 'down';
			break;
		default:
			return;
		}

		// Perform navigation. If the shift key is also pressed, don't move the
		// start point of the range:
		e.preventDefault ();
		navigate (direction, !e.shiftKey);
	});
});