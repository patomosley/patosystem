document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // UTILITÁRIOS DE REDE
    // ============================================================

    /**
     * Calcula o gateway a partir de um IP com máscara CIDR.
     * Para /30 e /31: usa o primeiro endereço utilizável.
     * Para /32: retorna o próprio IP.
     * Para subnets maiores (/24, /25, etc.): usa o IP da rede + 1.
     *
     * Exemplos:
     *   172.16.20.2/30  → 172.16.20.1
     *   10.0.0.5/24     → 10.0.0.1
     *   200.1.2.3/32    → 200.1.2.3
     */
    function calcularGateway(cidr) {
        if (!cidr || !cidr.includes('/')) return null;
        const [ip, prefixStr] = cidr.trim().split('/');
        const prefix = parseInt(prefixStr, 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;

        if (prefix === 32) return ip;

        // Converte IP para número de 32 bits
        const ipInt = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];

        // Máscara
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

        // IP da rede
        const networkInt = (ipInt & mask) >>> 0;

        if (prefix === 31) {
            // Em /31 (RFC 3021): os dois IPs são host.
            // Gateway é o par — se o IP termina em número par, gateway é o próximo (ímpar), e vice-versa.
            const lastOctet = ipInt & 0xFF;
            const gwInt = (lastOctet % 2 === 0) ? (ipInt + 1) >>> 0 : (ipInt - 1) >>> 0;
            return intToIp(gwInt);
        }

        // Para /30 e subnets menores: gateway = rede + 1
        const gwInt = (networkInt + 1) >>> 0;
        return intToIp(gwInt);
    }

    function intToIp(n) {
        return [
            (n >>> 24) & 0xFF,
            (n >>> 16) & 0xFF,
            (n >>> 8)  & 0xFF,
            n          & 0xFF
        ].join('.');
    }

    function validarCIDR(cidr) {
        if (!cidr || !cidr.includes('/')) return false;
        const [ip, prefixStr] = cidr.split('/');
        const prefix = parseInt(prefixStr, 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
        const parts = ip.split('.').map(Number);
        return parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255);
    }

    /**
     * Injeta o campo de gateway automaticamente baseado no campo WAN/IP.
     * Chamado após renderizar o formulário para campos com data-calc-gateway.
     */
    function setupGatewayAutoCalc() {
        document.querySelectorAll('[data-calc-gateway]').forEach(input => {
            const targetId = input.dataset.calcGateway;
            const targetInput = document.getElementById(targetId);
            const hintEl = input.parentElement.querySelector('.input-hint');
            if (!targetInput) return;

            const atualizar = () => {
                const val = input.value.trim();
                if (!val) {
                    targetInput.value = '';
                    targetInput.closest('.form-group').classList.remove('gateway-auto-set');
                    if (hintEl) { hintEl.className = 'input-hint'; hintEl.textContent = ''; }
                    input.classList.remove('input-valid', 'input-error');
                    return;
                }

                if (validarCIDR(val)) {
                    const gw = calcularGateway(val);
                    targetInput.value = gw;
                    input.classList.add('input-valid');
                    input.classList.remove('input-error');
                    if (hintEl) {
                        hintEl.className = 'input-hint gateway-hint show';
                        hintEl.textContent = `✓ Gateway calculado automaticamente: ${gw}`;
                    }
                } else {
                    targetInput.value = '';
                    input.classList.add('input-error');
                    input.classList.remove('input-valid');
                    if (hintEl) {
                        hintEl.className = 'input-hint error-hint show';
                        hintEl.textContent = 'Formato inválido. Use: 192.168.1.1/24';
                    }
                }
            };

            input.addEventListener('input', atualizar);
            input.addEventListener('blur', atualizar);
        });
    }

    // ============================================================
    // ELEMENTOS DO DOM
    // ============================================================
    const themeToggleButton = document.getElementById('theme-toggle');
    const contentArea       = document.getElementById('content-area');
    const scriptModal       = document.getElementById('script-modal');
    const closeModalButton  = document.getElementById('close-modal');
    const modalCloseBtn     = document.getElementById('modal-close-button');
    const modalCopyButton   = document.getElementById('modal-copy-button');
    const scriptOutput      = document.getElementById('script-output');
    const modalTitle        = document.getElementById('modal-title');
    const notification      = document.getElementById('notification');

    // ============================================================
    // TEMPLATES DE FORMULÁRIO
    // Todos os campos de IP WAN têm data-calc-gateway="wanGateway"
    // O campo de gateway é readonly e preenchido automaticamente.
    // ============================================================

    function wanBlock(extra = '') {
        return `
        <div class="form-section">
            <div class="form-section-header">
                <div class="section-icon">🌐</div>
                <h2>Conexão WAN</h2>
            </div>
            <div class="form-section-body">
                ${extra}
                <div class="form-group">
                    <label>Tipo de Conexão</label>
                    <div class="radio-group">
                        <input type="radio" id="conn-untagged" name="connectionType" value="untagged" checked>
                        <label for="conn-untagged">Untagged (Ether1 direto)</label>
                        <input type="radio" id="conn-tagged" name="connectionType" value="tagged">
                        <label for="conn-tagged">Tagged (via VLAN)</label>
                    </div>
                </div>
                <div class="form-group hidden" id="vlan-group">
                    <label for="vlanId">ID da VLAN</label>
                    <div class="input-wrapper">
                        <input type="text" id="vlanId" name="vlanId" placeholder="Ex: 100">
                    </div>
                </div>
                <div class="form-group">
                    <label for="wanNetwork">IP WAN (endereço/máscara)</label>
                    <div class="input-wrapper">
                        <input type="text" id="wanNetwork" name="wanNetwork"
                               placeholder="Ex: 172.16.20.2/30"
                               data-calc-gateway="wanGateway">
                        <div class="input-hint"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="wanGateway">Gateway WAN <span style="font-weight:400;color:var(--accent-color);font-size:10px;letter-spacing:0">(calculado automaticamente)</span></label>
                    <div class="input-wrapper">
                        <input type="text" id="wanGateway" name="wanGateway"
                               placeholder="Preenchido ao digitar o IP acima"
                               readonly style="opacity:0.7;cursor:default;">
                    </div>
                </div>
            </div>
        </div>`;
    }

    function lanBlock(defaultVal = '') {
        return `
        <div class="form-section">
            <div class="form-section-header">
                <div class="section-icon">🏠</div>
                <h2>Rede LAN</h2>
            </div>
            <div class="form-section-body">
                <div class="form-group">
                    <label for="lanNetwork">Rede LAN (endereço/máscara)</label>
                    <div class="input-wrapper">
                        <input type="text" id="lanNetwork" name="lanNetwork"
                               placeholder="Ex: 192.168.0.1/24" value="${defaultVal}">
                    </div>
                </div>
            </div>
        </div>`;
    }

    function dnsBlock() {
        return `
                <div class="form-group">
                    <label for="dns1">DNS Primário</label>
                    <div class="input-wrapper">
                        <input type="text" id="dns1" name="dns1" value="177.37.220.17">
                    </div>
                </div>
                <div class="form-group">
                    <label for="dns2">DNS Secundário</label>
                    <div class="input-wrapper">
                        <input type="text" id="dns2" name="dns2" value="8.8.8.8">
                    </div>
                </div>`;
    }

    const clientTemplates = {

        'etice': {
            name: 'ETICE',
            category: 'B2G',
            fields: `
                ${wanBlock()}
                ${lanBlock()}
            `
        },
        'etice-eoip': {
            name: 'ETICE EoIP',
            category: 'B2G',
            fields: `
                ${wanBlock()}
                ${lanBlock()}
            `
        },

        'ce-conectado': {
            name: 'ETICE CE Conectado',
            category: 'B2G',
            fields: `
                ${wanBlock()}
                ${lanBlock()}
            `
        },

        'pppoe': {
            name: 'PPPoE',
            category: 'Banda Larga',
            fields: `
                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🔐</div>
                        <h2>Conexão WAN — PPPoE</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label for="pppoeUser">Usuário PPPoE</label>
                            <input type="text" id="pppoeUser" name="pppoeUser" placeholder="Ex: cliente@provedor">
                        </div>
                        <div class="form-group">
                            <label for="pppoePass">Senha PPPoE</label>
                            <input type="password" id="pppoePass" name="pppoePass" placeholder="••••••••">
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🏠</div>
                        <h2>Rede LAN</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label for="lanNetwork">Rede LAN (endereço/máscara)</label>
                            <input type="text" id="lanNetwork" name="lanNetwork"
                                   placeholder="Ex: 192.168.0.1/24" value="192.168.0.1/24">
                        </div>
                        ${dnsBlock()}
                    </div>
                </div>
            `
        },

        'ipd-dhpcp': {
            name: 'IPD Direto com DHCP',
            category: 'Banda Larga',
            fields: `
                ${wanBlock('<p>Script para IP Direto com DHCP na LAN. Interface WAN padrão: ether1.</p>')}
                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🏠</div>
                        <h2>Rede LAN</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label for="lanNetwork">Rede LAN (endereço/máscara)</label>
                            <input type="text" id="lanNetwork" name="lanNetwork"
                                   placeholder="Ex: 192.168.0.1/24" value="192.168.0.1/24">
                        </div>
                        ${dnsBlock()}
                    </div>
                </div>
            `
        },

        'ipd-roteado-dhcp': {
            name: 'IPD Roteado com DHCP',
            category: 'Banda Larga',
            fields: `
                ${wanBlock()}
                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🌍</div>
                        <h2>IP Válido (Loopback)</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label for="ipValido">IP Válido (endereço/máscara)</label>
                            <input type="text" id="ipValido" name="ipValido"
                                   placeholder="Ex: 200.20.10.1/32">
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🏠</div>
                        <h2>Rede Local</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label for="lanNetwork">Rede LAN (endereço/máscara)</label>
                            <input type="text" id="lanNetwork" name="lanNetwork"
                                   placeholder="Ex: 192.168.0.1/24">
                        </div>
                        ${dnsBlock()}
                    </div>
                </div>
            `
        },

        'ipd-direto': {
            name: 'IPD Direto',
            category: 'Links Dedicados',
            fields: `
                ${wanBlock('<p>Para links /31 direto no MikroTik: após rodar o script, remova a máscara /31 dentro da RB pois o RouterOS não é compatível com essa notação em alguns modelos.</p>')}
                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🏠</div>
                        <h2>Rede LAN</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label for="lanNetwork">Rede LAN (endereço/máscara)</label>
                            <input type="text" id="lanNetwork" name="lanNetwork"
                                   placeholder="Ex: 192.168.0.1/24" value="192.168.0.1/24">
                        </div>
                        ${dnsBlock()}
                    </div>
                </div>
            `
        },

        'ipd-roteado': {
            name: 'IPD Roteado',
            category: 'Links Dedicados',
            fields: `
                ${wanBlock()}
                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🏠</div>
                        <h2>Rede LAN</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label for="lanNetwork">Rede LAN (endereço/máscara)</label>
                            <input type="text" id="lanNetwork" name="lanNetwork"
                                   placeholder="Ex: 192.168.0.1/24">
                        </div>
                    </div>
                </div>
            `
        }
    };

    // ============================================================
    // TEMA
    // ============================================================
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleButton.textContent = savedTheme === 'light' ? '🌑' : '☀️';

    themeToggleButton.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggleButton.textContent = next === 'light' ? '🌑' : '☀️';
    });

    // ============================================================
    // MENU ACORDEÃO
    // ============================================================
    document.querySelectorAll('.menu-title').forEach(title => {
        title.addEventListener('click', () => {
            const submenu = title.nextElementSibling;
            title.classList.toggle('active');
            submenu.style.display = submenu.style.display === 'flex' ? 'none' : 'flex';
        });
    });

    // ============================================================
    // RENDER FORM
    // ============================================================
    document.querySelectorAll('.client-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.client-link').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const tpl = clientTemplates[e.currentTarget.dataset.client];
            if (tpl) renderForm(tpl);
        });
    });

    function renderForm(template) {
        const formHtml = `
            <form id="script-form" data-client="${template.name}">
                <div class="form-header">
                    <div class="form-header-left">
                        <h1>${template.name}</h1>
                        <div class="breadcrumb">
                            <span>${template.category}</span>
                            <span class="sep">/</span>
                            <span>${template.name}</span>
                        </div>
                    </div>
                    <span class="form-tag">MikroTik</span>
                </div>

                ${template.fields}

                <div class="form-section">
                    <div class="form-section-header">
                        <div class="section-icon">🔑</div>
                        <h2>Credenciais e Segurança</h2>
                    </div>
                    <div class="form-section-body">
                        <div class="form-group">
                            <label>Tipo de Usuário</label>
                            <div class="radio-group">
                                <input type="radio" id="user-default" name="userType" value="default" checked>
                                <label for="user-default">Padrão (ipc + suporte)</label>
                                <input type="radio" id="user-custom" name="userType" value="custom">
                                <label for="user-custom">Personalizado (cliente)</label>
                            </div>
                        </div>

                        <!-- Padrão: só mostra aviso informativo -->
                        <div id="default-user-info">
                            <p style="margin:0">Serão criados os usuários <strong>ipc</strong> e <strong>suporte</strong> com as senhas padrão, além da configuração de Radius.</p>
                        </div>

                        <!-- Personalizado: campos de user/senha do cliente, sem radius -->
                        <div id="custom-user-group" class="hidden">
                            <p style="margin:0 0 16px">Somente o usuário abaixo será criado. <strong>Usuários padrão e Radius não serão adicionados.</strong></p>
                            <div class="form-group">
                                <label for="customUser">Nome do Usuário</label>
                                <input type="text" id="customUser" name="customUser" placeholder="Ex: admin">
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label for="customPass">Senha</label>
                                <input type="password" id="customPass" name="customPass" placeholder="••••••••">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="buttons-container">
                    <button type="submit">⚡ Gerar Script</button>
                </div>
            </form>
        `;

        document.getElementById('form-container').innerHTML = formHtml;
        addFormListeners();
        setupGatewayAutoCalc();
    }

    function addFormListeners() {
        const form = document.getElementById('script-form');
        if (!form) return;

        form.addEventListener('submit', e => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            data.client = form.dataset.client;

            const script = generateScript(data);
            modalTitle.textContent = `Script — ${data.client}`;
            scriptOutput.innerHTML = '';

            const codeNode = document.createElement('code');
            codeNode.textContent = script;

            const copyBtnWrapper = document.createElement('div');
            copyBtnWrapper.className = 'copy-button-container';
            copyBtnWrapper.innerHTML = `<button class="copy-button" title="Copiar">📋 Copiar</button>`;
            copyBtnWrapper.querySelector('.copy-button').addEventListener('click', () => copyToClipboard(script));

            scriptOutput.appendChild(copyBtnWrapper);
            scriptOutput.appendChild(codeNode);
            scriptModal.style.display = 'flex';
        });

        // VLAN toggle
        form.querySelectorAll('input[name="connectionType"]').forEach(r => {
            r.addEventListener('change', e => {
                const vg = document.getElementById('vlan-group');
                if (vg) vg.classList.toggle('hidden', e.target.value !== 'tagged');
            });
        });

        // User type toggle
        form.querySelectorAll('input[name="userType"]').forEach(r => {
            r.addEventListener('change', e => {
                const isCustom = e.target.value === 'custom';
                document.getElementById('custom-user-group')?.classList.toggle('hidden', !isCustom);
                document.getElementById('default-user-info')?.classList.toggle('hidden', isCustom);
            });
        });
    }

    // ============================================================
    // GERAÇÃO DE SCRIPT
    // ============================================================
    function generateScript(data) {
        let script = `# Script gerado para: ${data.client}\n# Data: ${new Date().toLocaleString('pt-BR')}\n\n`;

        // Cabeçalho: credenciais variam conforme userType
        script += `# === Usuarios e Radius ===\n`;
        if (data.userType === 'custom') {
            // Somente o usuário do cliente — sem padrões, sem radius
            const nome = data.customUser || 'admin';
            const senha = data.customPass || '';
            script += `/user add name=${nome} password=${senha} group=full\n\n`;
        } else {
            // Usuários padrão + radius
            script += `/user add name=ipc password=bEDgRbhYtwbj89EeZ6oz group=full\n`;
            script += `/user add name=suporte password=B2U6B8afZ5wrA0ui3ZMNNc9uXR group=full\n\n`;
            script += `/radius add address=177.37.216.26 service=login secret=obK9K4NWY98o\n`;
            script += `/radius incoming set accept=yes\n`;
            script += `/user aaa set use-radius=yes accounting=yes interim-update=2m\n\n`;
        }

        script += `# === Hardening ===\n`;
        script += `/ip service disable [find where name!="winbox" and name!="ssh"]\n`;
        script += `/ip service set [find name=ssh] port=2225\n`;
        script += `/ip service set [find name=winbox] port=8295\n\n`;

        script += `# === SNMP ===\n`;
        script += `/snmp community add addresses=187.19.144.240/28 name=1TegnNpJqy read-access=yes\n`;
        script += `/snmp set enabled=yes trap-community=1TegnNpJqy trap-version=2\n\n`;

        script += `# === Configuracao de Rede — ${data.client} ===\n`;

        // Gateway: se por algum motivo estiver vazio, recalcula
        if (!data.wanGateway && data.wanNetwork) {
            data.wanGateway = calcularGateway(data.wanNetwork) || '';
        }

        const buildWanVlan = (wanInterfaceRef) => {
            let iface = 'ether1';
            if (data.connectionType === 'tagged' && data.vlanId) {
                iface = `vlan${data.vlanId}_WAN`;
                script += `/interface vlan add name=${iface} vlan-id=${data.vlanId} interface=ether1\n`;
            }
            return iface;
        };

        const buildBridgeLan = () => {
            script += `/interface bridge add name=br0 comment="Bridge LAN"\n`;
            script += `/interface bridge port add bridge=br0 interface=ether2\n`;
            script += `/interface bridge port add bridge=br0 interface=ether3\n`;
            script += `/interface bridge port add bridge=br0 interface=ether4\n`;
            script += `/interface bridge port add bridge=br0 interface=ether5\n\n`;
        };

        const buildDhcpLan = () => {
            const [lanIp, lanMask] = data.lanNetwork.split('/');
            const octets = lanIp.split('.');
            const netBase = `${octets[0]}.${octets[1]}.${octets[2]}`;
            script += `/ip pool add name=pool_lan ranges=${netBase}.10-${netBase}.254\n`;
            script += `/ip dhcp-server add name=dhcp_lan interface=br0 address-pool=pool_lan disabled=no\n`;
            script += `/ip dhcp-server network add address=${netBase}.0/${lanMask} gateway=${lanIp} dns-server=${data.dns1},${data.dns2}\n\n`;
        };

        // ---- Clientes específicos ----
        if (data.client === 'ETICE') {
            const wan = buildWanVlan();
            script += `/ip address add address=${data.wanNetwork} interface=${wan} comment="LINK_WAN"\n`;
            script += `/ip address add address=${data.lanNetwork} interface=ether2 comment="REDE_LAN"\n`;
            script += `/ip route add dst-address=0.0.0.0/0 gateway=${data.wanGateway}\n`;

         } else if (data.client === 'ETICE CE Conectado') {
            const wan = buildWanVlan();
            script += `/ip address add address=${data.wanNetwork} interface=${wan} comment="LINK_WAN"\n`;
            script += `/ip address add address=${data.lanNetwork} interface=ether3 comment="REDE_LAN"\n`;
            script += `/ip route add dst-address=0.0.0.0/0 gateway=${data.wanGateway}\n`;
            script += `/ip dhcp-relay add disable=no name=etice-relay interface=ether3 dhcp-server=172.21.134.1\n`;

        } else if (data.client === 'PPPoE') {
            buildBridgeLan();
            script += `/interface pppoe-client add name=pppoe-wan interface=ether1 user="${data.pppoeUser}" password="${data.pppoePass}" disabled=no add-default-route=yes use-peer-dns=no\n\n`;
            script += `/ip address add address=${data.lanNetwork} interface=br0\n\n`;
            buildDhcpLan();
            script += `/ip dns set servers=${data.dns1},${data.dns2} allow-remote-requests=yes\n\n`;
            script += `/ip firewall nat add chain=srcnat out-interface=pppoe-wan action=masquerade\n`;

        } else if (data.client === 'IPD Direto com DHCP') {
            const wan = buildWanVlan();
            script += `/ip address add address=${data.wanNetwork} interface=${wan} comment="LINK_WAN"\n`;
            script += `/ip route add dst-address=0.0.0.0/0 gateway=${data.wanGateway}\n\n`;
            buildBridgeLan();
            script += `/ip address add address=${data.lanNetwork} interface=br0 comment="REDE_LAN"\n\n`;
            script += `/ip dns set servers=${data.dns1},${data.dns2} allow-remote-requests=yes\n\n`;
            buildDhcpLan();
            script += `/ip firewall nat add chain=srcnat out-interface=${wan} action=masquerade\n`;

        } else if (data.client === 'IPD Roteado com DHCP') {
            const wan = buildWanVlan();
            script += `/ip address add address=${data.wanNetwork} interface=${wan} comment="LINK_WAN"\n`;
            script += `/ip route add dst-address=0.0.0.0/0 gateway=${data.wanGateway}\n`;
            script += `/interface bridge add name=loopback protocol-mode=none\n`;
            script += `/interface bridge add name=br0 comment="Rede Local"\n`;
            script += `/interface bridge port add bridge=br0 interface=ether2\n`;
            script += `/interface bridge port add bridge=br0 interface=ether3\n`;
            script += `/interface bridge port add bridge=br0 interface=ether4\n`;
            script += `/interface bridge port add bridge=br0 interface=ether5\n\n`;
            script += `/ip address add address=${data.ipValido} interface=loopback comment="Ip valido"\n`;
            script += `/ip address add address=${data.lanNetwork} interface=br0 comment="rede local"\n`;
            buildDhcpLan();
            script += `/ip firewall nat add chain=srcnat out-interface=${wan} action=src-nat to-addresses=${data.ipValido?.split('/')[0]}\n`;

        } else if (data.client === 'IPD Direto') {
            const wan = buildWanVlan();
            script += `/ip address add address=${data.wanNetwork} interface=${wan} comment="LINK_WAN"\n`;
            script += `/ip route add dst-address=0.0.0.0/0 gateway=${data.wanGateway}\n\n`;
            buildBridgeLan();
            script += `/ip address add address=${data.lanNetwork} interface=br0 comment="REDE_LAN"\n\n`;
            script += `/ip dns set servers=${data.dns1},${data.dns2} allow-remote-requests=yes\n\n`;
            buildDhcpLan();
            script += `/ip firewall nat add chain=srcnat action=masquerade\n`;

        } else if (data.client === 'IPD Roteado') {
            const wan = buildWanVlan();
            script += `/ip address add address=${data.wanNetwork} interface=${wan} comment="LINK_WAN"\n`;
            script += `/ip address add address=${data.lanNetwork} interface=ether2 comment="REDE_LAN"\n`;
            script += `/ip route add dst-address=0.0.0.0/0 gateway=${data.wanGateway}\n\n`;
            script += `/ip firewall nat add chain=srcnat out-interface=vlan850_WAN action=src-nat to-addresses=${data.lanNetwork}\n`;
            buildDhcpLan();
        }
        script += `# === REMOVE USER ADMIN ===\n`;
        script += `/user remove [find name=admin]\n\n`;
        script += `\n# --- Fim do Script ---`;
        return script;
    }

    // ============================================================
    // MODAL & CLIPBOARD
    // ============================================================
    function closeModal() { scriptModal.style.display = 'none'; }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(showNotification).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(el);
        el.select();
        try { document.execCommand('copy'); showNotification(); } catch(e) {}
        document.body.removeChild(el);
    }

    function showNotification() {
        notification.style.display = 'flex';
        setTimeout(() => { notification.style.display = 'none'; }, 3200);
    }

    closeModalButton.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);
    modalCopyButton.addEventListener('click', () => {
        const code = scriptOutput.querySelector('code');
        if (code) copyToClipboard(code.textContent);
    });
    window.addEventListener('click', e => { if (e.target === scriptModal) closeModal(); });

});
