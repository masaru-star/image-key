        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileStatus = document.getElementById('fileStatus');
        const previewContainer = document.getElementById('previewContainer');
        const imagePreview = document.getElementById('imagePreview');
        const fileNameDisp = document.getElementById('fileName');
        const messageBox = document.getElementById('messageBox');

        let selectedFileArrayBuffer = null;

        // --- UI Logic ---
        dropZone.onclick = () => fileInput.click();
        
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        };
        
        dropZone.ondragleave = () => dropZone.classList.remove('active');
        
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
            handleFiles(e.dataTransfer.files);
        };

        fileInput.onchange = (e) => handleFiles(e.target.files);

        function showMessage(text, isError = false) {
            messageBox.textContent = text;
            messageBox.className = `p-4 rounded-lg text-sm font-medium text-center ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
            messageBox.classList.remove('hidden');
        }

        async function handleFiles(files) {
            if (files.length === 0) return;
            const file = files[0];

            if (file.type !== 'image/png') {
                showMessage("PNG形式の画像のみ使用可能です。", true);
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                showMessage("ファイルサイズは2MBまでです。", true);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                selectedFileArrayBuffer = e.target.result;
                imagePreview.src = URL.createObjectURL(file);
                fileNameDisp.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                fileStatus.classList.add('hidden');
                previewContainer.classList.remove('hidden');
                showMessage("画像の読み込みに成功しました。鍵として準備完了です。");
            };
            reader.readAsArrayBuffer(file);
        }

        // --- Crypto Logic ---

        // Derive key from image using SHA-256
        async function deriveKeyFromImage(arrayBuffer) {
            // Hash the entire binary to create a stable 256-bit key
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            return await crypto.subtle.importKey(
                'raw',
                hashBuffer,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
        }

        // Encryption
        document.getElementById('encryptBtn').onclick = async () => {
            const text = document.getElementById('plainText').value;
            if (!selectedFileArrayBuffer) return showMessage("鍵となる画像を選択してください。", true);
            if (!text) return showMessage("暗号化する文字列を入力してください。", true);

            try {
                const key = await deriveKeyFromImage(selectedFileArrayBuffer);
                const iv = crypto.getRandomValues(new Uint8Array(12)); // Initialization Vector
                const encoded = new TextEncoder().encode(text);

                const ciphertext = await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    encoded
                );

                // Combine IV + Ciphertext into a single Base64 string
                const combined = new Uint8Array(iv.length + ciphertext.byteLength);
                combined.set(iv, 0);
                combined.set(new Uint8Array(ciphertext), iv.length);

                const base64 = btoa(String.fromCharCode(...combined));
                document.getElementById('cipherText').value = base64;
                showMessage("暗号化が完了しました。");
            } catch (err) {
                console.error(err);
                showMessage("暗号化中にエラーが発生しました。", true);
            }
        };

        // Decryption
        document.getElementById('decryptBtn').onclick = async () => {
            const base64 = document.getElementById('cipherText').value;
            if (!selectedFileArrayBuffer) return showMessage("鍵となる画像を選択してください。", true);
            if (!base64) return showMessage("復号するデータを入力してください。", true);

            try {
                const combined = new Uint8Array(atob(base64).split("").map(c => c.charCodeAt(0)));
                const iv = combined.slice(0, 12);
                const data = combined.slice(12);

                const key = await deriveKeyFromImage(selectedFileArrayBuffer);

                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    data
                );

                const decoded = new TextDecoder().decode(decrypted);
                document.getElementById('plainText').value = decoded;
                showMessage("復号に成功しました。");
            } catch (err) {
                console.error(err);
                showMessage("復号に失敗しました。画像が異なるか、データが破損しています。", true);
            }
        };
